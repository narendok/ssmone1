/**
 * Isolated-only HTTP driver for the pending lifecycle document draft contract.
 *
 * It uses the normal authenticated TanStack Start server-function endpoint for
 * SaveDraft. It never calls execute_lifecycle_document_action directly, never
 * accepts an actor id, and never uses a privileged key. Readiness is fail-closed:
 * SQL/RPC catalog and storage access are intentionally not probed through a
 * bearer browser session, so they remain BLOCKED until a reviewed, read-only
 * deployment-observation adapter is supplied by the operator.
 */
import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { ISOLATED_BACKEND_REF, ORIGINAL_BACKEND_REF, assertIsolatedTarget } from './lifecycle_document_draft_isolated_acceptance_runner.mjs'

export const PROJECT_DRIVE_BUCKET = 'project-drive'
export const BLOCKED_DEPLOYMENT_OBSERVATION = 'reviewed_read_only_deployment_observation_adapter'
export const OBSERVER_FUNCTION_NAME = 'getLifecycleDeploymentObservation_createServerFn_handler'
export const SAVE_DRAFT_FUNCTION_NAME = 'generateLifecycleDocumentDraft_createServerFn_handler'

const TOKEN_PATTERN = /(?:bearer\s+)?(?:eyJ[a-zA-Z0-9_-]+\.[a-zA-Z0-9._-]+\.[a-zA-Z0-9_-]+|sb_(?:publishable|secret)_[a-zA-Z0-9_-]+)/gi
const SENSITIVE_URL_PATTERN = /([?&](?:access_token|token|apikey|api_key|authorization)=)[^&#\s]+/gi

export function redactSensitive(value) {
  return String(value ?? '')
    .replace(TOKEN_PATTERN, '[REDACTED]')
    .replace(SENSITIVE_URL_PATTERN, '$1[REDACTED]')
}

export class IsolatedDriverError extends Error {
  constructor(code, message, cause) {
    super(redactSensitive(message))
    this.name = 'IsolatedDriverError'
    this.code = code
    this.cause = cause ? redactSensitive(cause instanceof Error ? cause.message : cause) : undefined
  }
}

function blocked(contract) {
  return { status: 'BLOCKED', missingContract: contract }
}

function strictAppOrigin(origin) {
  const parsed = new URL(origin)
  if (parsed.protocol !== 'https:' || parsed.username || parsed.password || parsed.port || parsed.pathname !== '/' || parsed.search || parsed.hash) {
    throw new IsolatedDriverError('INVALID_ORIGIN', 'The acceptance origin must be an exact HTTPS application origin.')
  }
  if (parsed.hostname.includes(ORIGINAL_BACKEND_REF)) throw new IsolatedDriverError('ORIGINAL_TARGET', 'Refusing an origin for the original backend.')
  return parsed.origin
}

function requireApprovedAppOrigin(origin, allowedOrigin) {
  const safeOrigin = strictAppOrigin(origin)
  if (typeof allowedOrigin !== 'string' || strictAppOrigin(allowedOrigin) !== safeOrigin) {
    throw new IsolatedDriverError('ORIGIN_MISMATCH', 'The acceptance origin is not the operator-approved isolated application origin.')
  }
  return safeOrigin
}

export function discoverServerFunctionEndpoint(manifestSource, functionName = OBSERVER_FUNCTION_NAME) {
  if (typeof manifestSource !== 'string' || !manifestSource.trim()) {
    throw new IsolatedDriverError('MANIFEST_MISSING', 'A generated server-function manifest is required for endpoint discovery.')
  }
  const entries = [...manifestSource.matchAll(/"([a-f0-9]{64})":\s*\{\s*functionName:\s*"([^"]+)"/g)]
  const match = entries.find((entry) => entry[2] === functionName)
  if (!match) {
    throw new IsolatedDriverError('OBSERVER_ENDPOINT_UNRESOLVED', 'The reviewed deployment-observation server function is absent from the generated manifest.')
  }
  return { id: match[1], path: `/_serverFn/${match[1]}`, functionName: match[2] }
}

export async function discoverServerFunctionEndpointFromFile(manifestPath, readFileImpl = readFile, functionName = OBSERVER_FUNCTION_NAME) {
  if (typeof manifestPath !== 'string' || !manifestPath.trim()) {
    throw new IsolatedDriverError('MANIFEST_MISSING', 'A generated server-function manifest path is required.')
  }
  try {
    return discoverServerFunctionEndpoint(await readFileImpl(manifestPath, 'utf8'), functionName)
  } catch (error) {
    if (error instanceof IsolatedDriverError) throw error
    throw new IsolatedDriverError('MANIFEST_READ_FAILED', 'The generated server-function manifest could not be read.', error)
  }
}

function requireBearer(session, label) {
  if (typeof session !== 'string' || !session.trim()) {
    throw new IsolatedDriverError('MISSING_SESSION', `${label} session is required only when mutation mode is explicitly invoked.`)
  }
  return session.trim()
}

function readResponseBody(response) {
  return response.text().catch(() => '')
}

function serialiseServerFnPayload(data) {
  // TanStack Start serializes JSON-only POST function input as { data }.
  return JSON.stringify({ data })
}

function sourceExpectation(input) {
  const expected = input?.expectedSource
  if (!expected || typeof expected.templateId !== 'string' || typeof expected.templateDocumentRevisionId !== 'string' || !/^[a-f0-9]{64}$/i.test(expected.sourceFingerprint ?? '')) {
    return undefined
  }
  return expected
}

function observerCapability(report, name) {
  const value = report?.capabilities?.[name]
  return value && typeof value === 'object' && typeof value.status === 'string'
    ? value
    : blocked('observer_response_missing_capability')
}

export function createIsolatedLifecycleHttpDriver({ backendRef, origin, approvedOrigin, fetchImpl = fetch, manifestSource, manifestPath, readFileImpl, observationAdapter } = {}) {
  assertIsolatedTarget(backendRef)
  const safeOrigin = requireApprovedAppOrigin(origin, approvedOrigin)
  if (typeof fetchImpl !== 'function') throw new IsolatedDriverError('MISSING_TRANSPORT', 'A fetch implementation is required.')

  const discoverEndpoint = (functionName) => manifestSource !== undefined
    ? Promise.resolve().then(() => discoverServerFunctionEndpoint(manifestSource, functionName))
    : discoverServerFunctionEndpointFromFile(manifestPath, readFileImpl, functionName)

  async function invokeServerFunction(endpoint, session, data) {
    const bearer = requireBearer(session, 'Manager')
    let response
    try {
      response = await fetchImpl(`${safeOrigin}${endpoint.path}`, {
        method: 'POST',
        redirect: 'error',
        headers: {
          accept: 'application/json',
          'content-type': 'application/json',
          'x-tsr-serverFn': 'true',
          authorization: `Bearer ${bearer}`,
        },
        body: serialiseServerFnPayload(data),
      })
    } catch (error) {
      throw new IsolatedDriverError('TRANSPORT_FAILURE', 'Authenticated application transport failed.', error)
    }
    if (response.redirected || new URL(response.url || safeOrigin).origin !== safeOrigin) {
      throw new IsolatedDriverError('REDIRECT_OR_OFF_ORIGIN', 'Refusing redirected or off-origin authenticated application transport.')
    }
    if (!response.ok) {
      const body = await readResponseBody(response)
      throw new IsolatedDriverError('APPLICATION_DENIED', `Authenticated application transport returned ${response.status}: ${body}`)
    }
    return response
  }

  async function invokeSaveDraft({ session, data }) {
    let endpoint
    try { endpoint = await discoverEndpoint(SAVE_DRAFT_FUNCTION_NAME) } catch (error) {
      throw new IsolatedDriverError('SAVE_DRAFT_ENDPOINT_UNRESOLVED', 'The generated manifest does not resolve the reviewed SaveDraft endpoint.', error)
    }
    return invokeServerFunction(endpoint, session, data)
  }

  async function inspectReadiness({ session, projectId, requestKey, expectedSource } = {}) {
    const observation = {
      backendRef,
      authenticatedApplicationTransport: false,
      authorizeLifecycleDocumentDraft: false,
      registerLifecycleDocumentStorageAttempt: false,
      findLifecycleDocumentDraftReceipt: false,
      commitLifecycleDocumentDraft: false,
      canDiscardLifecycleDocumentObject: false,
      projectDriveUploadDownload: false,
      observabilityReadback: false,
      deployed: {
        applicationTransport: undefined,
        actorGateway: undefined,
        serverOperations: [],
        storageBucket: undefined,
        storageUploadDownload: false,
        schemaReadback: false,
        observabilityReadback: false,
      },
      capabilities: {
        applicationTransport: blocked('generated_observer_endpoint_unresolved'),
        actorGateway: blocked(BLOCKED_DEPLOYMENT_OBSERVATION),
        rpcSchema: blocked(BLOCKED_DEPLOYMENT_OBSERVATION),
        projectDriveStorage: blocked(BLOCKED_DEPLOYMENT_OBSERVATION),
        observabilityReadback: blocked(BLOCKED_DEPLOYMENT_OBSERVATION),
      },
    }
    const source = sourceExpectation({ expectedSource })
    if (!source) {
      observation.capabilities.observabilityReadback = blocked('source_exactness_unverified')
      return observation
    }
    let endpoint
    try {
      endpoint = await discoverEndpoint(OBSERVER_FUNCTION_NAME)
    } catch (error) {
      observation.capabilities.deploymentObservation = blocked('generated_observer_endpoint_unresolved')
      return observation
    }
    observation.capabilities.applicationTransport = { status: 'OBSERVED', endpoint: endpoint.path }
    observation.authenticatedApplicationTransport = true
    observation.deployed.applicationTransport = 'authenticated-server-action'
    if (!session || !projectId || !requestKey) {
      observation.capabilities.deploymentObservation = blocked('observer_request_scope_or_session_missing')
      return observation
    }
    let reported
    try {
      if (observationAdapter?.inspect) {
        reported = await observationAdapter.inspect({ backendRef, origin: safeOrigin, projectId, requestKey, expectedSource: source })
      } else {
        const response = await invokeServerFunction(endpoint, session, { backendRef, projectId, requestKey, expectedSource: source })
        reported = await response.json()
      }
    } catch (error) {
      observation.capabilities.deploymentObservation = blocked('observer_transport_or_denial')
      return observation
    }
    if (!reported || reported.backendRef !== backendRef || reported.status !== 'BLOCKED') {
      observation.capabilities.deploymentObservation = blocked('observer_response_unverified')
      return observation
    }
    observation.capabilities.actorGateway = observerCapability(reported, 'actorGateway')
    observation.capabilities.rpcSchema = observerCapability(reported, 'rpcSchema')
    observation.capabilities.projectDriveStorage = observerCapability(reported, 'projectDriveStorage')
    observation.capabilities.observabilityReadback = observerCapability(reported, 'observabilityReadback')
    observation.capabilities.deploymentObservation = blocked(reported.missingContract || BLOCKED_DEPLOYMENT_OBSERVATION)
    return observation
  }

  async function readSavedFileAndVerify({ signedDownloadUrl, expectedSha256, fetchFile = fetchImpl }) {
    if (typeof signedDownloadUrl !== 'string' || !signedDownloadUrl) {
      throw new IsolatedDriverError('MISSING_READBACK_URL', 'Saved-file readback requires a server-observed signed download URL.')
    }
    let response
    try {
      response = await fetchFile(signedDownloadUrl, { method: 'GET' })
    } catch (error) {
      throw new IsolatedDriverError('READBACK_TRANSPORT_FAILURE', 'Saved-file readback failed.', error)
    }
    if (!response.ok) {
      throw new IsolatedDriverError('READBACK_DENIED', `Saved-file readback returned ${response.status}.`)
    }
    const bytes = new Uint8Array(await response.arrayBuffer())
    const observedSha256 = createHash('sha256').update(bytes).digest('hex')
    if (typeof expectedSha256 !== 'string' || observedSha256 !== expectedSha256) {
      throw new IsolatedDriverError('HASH_MISMATCH', 'Saved-file bytes did not match the server-provided SHA256 checksum.')
    }
    return { byteLength: bytes.byteLength, sha256: observedSha256 }
  }

  async function runMutationCases() {
    // The specific mutation matrix is intentionally not fabricated. It requires
    // approved runtime sessions and fixture identifiers supplied only by the
    // operator at the time of a separately authorized live acceptance run.
    throw new IsolatedDriverError('MUTATION_CASES_BLOCKED', 'Mutation cases require an approved isolated fixture contract and runtime sessions; no live mutation was attempted.')
  }

  return { inspectReadiness, invokeSaveDraft, readSavedFileAndVerify, runMutationCases }
}

/** Loader entry point used by the generic acceptance runner. It is read-only
 * unless that runner later receives an explicit mutation opt-in and approved
 * runtime fixture adapter. */
export function createDriver({ backendRef, origin }) {
  return createIsolatedLifecycleHttpDriver({ backendRef, origin, approvedOrigin: origin })
}
