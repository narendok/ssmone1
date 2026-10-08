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
import { ISOLATED_BACKEND_REF, ORIGINAL_BACKEND_REF, assertIsolatedTarget } from './lifecycle_document_draft_isolated_acceptance_runner.mjs'

export const LIFECYCLE_SAVE_DRAFT_SERVER_FN_ID = '4c3d00a3303a08561cf24c7b6d461f1cc91c951677abe6c37a93e6a59b99d072'
export const LIFECYCLE_SAVE_DRAFT_PATH = `/_serverFn/${LIFECYCLE_SAVE_DRAFT_SERVER_FN_ID}`
export const PROJECT_DRIVE_BUCKET = 'project-drive'
export const BLOCKED_DEPLOYMENT_OBSERVATION = 'reviewed_read_only_deployment_observation_adapter'

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

function requireIsolatedOrigin(origin) {
  const parsed = new URL(origin)
  if (parsed.protocol !== 'https:') throw new IsolatedDriverError('INVALID_ORIGIN', 'The acceptance origin must use HTTPS.')
  if (parsed.hostname.includes(ORIGINAL_BACKEND_REF)) throw new IsolatedDriverError('ORIGINAL_TARGET', 'Refusing an origin for the original backend.')
  return parsed.origin
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
  // The action input is a JSON-only zod shape. The TanStack request contract is
  // { data }, with x-tsr-serverFn=true and application/json.
  return JSON.stringify({ data })
}

export function createIsolatedLifecycleHttpDriver({ backendRef, origin, fetchImpl = fetch, observationAdapter } = {}) {
  assertIsolatedTarget(backendRef)
  const safeOrigin = requireIsolatedOrigin(origin)
  if (typeof fetchImpl !== 'function') throw new IsolatedDriverError('MISSING_TRANSPORT', 'A fetch implementation is required.')

  async function invokeSaveDraft({ session, data }) {
    const bearer = requireBearer(session, 'Manager')
    let response
    try {
      response = await fetchImpl(`${safeOrigin}${LIFECYCLE_SAVE_DRAFT_PATH}`, {
        method: 'POST',
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
    if (!response.ok) {
      const body = await readResponseBody(response)
      throw new IsolatedDriverError('APPLICATION_DENIED', `Authenticated application transport returned ${response.status}: ${body}`)
    }
    return response
  }

  async function inspectReadiness() {
    const observation = {
      backendRef,
      authenticatedApplicationTransport: true,
      authorizeLifecycleDocumentDraft: false,
      registerLifecycleDocumentStorageAttempt: false,
      findLifecycleDocumentDraftReceipt: false,
      commitLifecycleDocumentDraft: false,
      canDiscardLifecycleDocumentObject: false,
      projectDriveUploadDownload: false,
      observabilityReadback: false,
      deployed: {
        applicationTransport: 'authenticated-server-action',
        actorGateway: undefined,
        serverOperations: [],
        storageBucket: undefined,
        storageUploadDownload: false,
        schemaReadback: false,
        observabilityReadback: false,
      },
      capabilities: {
        applicationTransport: { status: 'OBSERVED', endpoint: LIFECYCLE_SAVE_DRAFT_PATH },
        actorGateway: blocked(BLOCKED_DEPLOYMENT_OBSERVATION),
        rpcSchema: blocked(BLOCKED_DEPLOYMENT_OBSERVATION),
        projectDriveStorage: blocked(BLOCKED_DEPLOYMENT_OBSERVATION),
        observabilityReadback: blocked(BLOCKED_DEPLOYMENT_OBSERVATION),
      },
    }
    if (!observationAdapter || typeof observationAdapter.inspect !== 'function') return observation

    let reported
    try {
      reported = await observationAdapter.inspect({ backendRef, origin: safeOrigin })
    } catch (error) {
      observation.capabilities.deploymentObservation = blocked(BLOCKED_DEPLOYMENT_OBSERVATION)
      observation.capabilities.deploymentObservation.error = redactSensitive(error instanceof Error ? error.message : error)
      return observation
    }
    if (!reported || reported.backendRef !== backendRef || reported.verified !== true) {
      observation.capabilities.deploymentObservation = blocked(BLOCKED_DEPLOYMENT_OBSERVATION)
      return observation
    }
    // The adapter must provide independently-observed evidence, not booleans.
    const operations = Array.isArray(reported.serverOperations) ? reported.serverOperations : []
    const storage = reported.storage
    const observability = reported.observability
    const required = [
      'authorize_lifecycle_document_draft',
      'register_lifecycle_document_storage_attempt',
      'find_lifecycle_document_draft_receipt',
      'commit_lifecycle_document_draft',
      'can_discard_lifecycle_document_object',
    ]
    const hasOperations = required.every((operation) => operations.includes(operation))
    const hasStorage = storage?.bucket === PROJECT_DRIVE_BUCKET && storage.uploadDownloadObserved === true
    const hasObservability = observability?.readbackObserved === true
    if (!hasOperations || !hasStorage || !hasObservability || reported.actorGateway !== 'execute_lifecycle_document_action') {
      observation.capabilities.deploymentObservation = blocked(BLOCKED_DEPLOYMENT_OBSERVATION)
      return observation
    }
    Object.assign(observation, {
      authorizeLifecycleDocumentDraft: true,
      registerLifecycleDocumentStorageAttempt: true,
      findLifecycleDocumentDraftReceipt: true,
      commitLifecycleDocumentDraft: true,
      canDiscardLifecycleDocumentObject: true,
      projectDriveUploadDownload: true,
      observabilityReadback: true,
      deployed: {
        applicationTransport: 'authenticated-server-action',
        actorGateway: 'execute_lifecycle_document_action',
        serverOperations: operations,
        storageBucket: PROJECT_DRIVE_BUCKET,
        storageUploadDownload: true,
        schemaReadback: true,
        observabilityReadback: true,
      },
      capabilities: {
        ...observation.capabilities,
        actorGateway: { status: 'OBSERVED' },
        rpcSchema: { status: 'OBSERVED' },
        projectDriveStorage: { status: 'OBSERVED' },
        observabilityReadback: { status: 'OBSERVED' },
      },
    })
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
