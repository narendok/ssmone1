import { describe, expect, it, vi } from 'vitest'
import {
  BLOCKED_DEPLOYMENT_OBSERVATION,
  IsolatedDriverError,
  OBSERVER_FUNCTION_NAME,
  SAVE_DRAFT_FUNCTION_NAME,
  createIsolatedLifecycleHttpDriver,
  discoverServerFunctionEndpoint,
  discoverServerFunctionEndpointFromGeneratedBuild,
  redactSensitive,
} from './lifecycle_document_draft_isolated_http_driver.mjs'
import { ISOLATED_BACKEND_REF } from './lifecycle_document_draft_isolated_acceptance_runner.mjs'

const origin = 'https://isolated.example.test'
const session = 'eyJheader.verySecretPayload.signature'
const payload = {
  projectId: '00000000-0000-0000-0000-000000000001',
  templateId: '00000000-0000-0000-0000-000000000002',
  templateVersion: 1,
  templateDocumentRevisionId: '00000000-0000-0000-0000-000000000003',
  targetFolderId: '00000000-0000-0000-0000-000000000004',
  requestKey: '00000000-0000-0000-0000-000000000005',
}

const observerInput = {
  projectId: payload.projectId,
  requestKey: payload.requestKey,
  expectedSource: {
    templateId: payload.templateId,
    templateDocumentRevisionId: payload.templateDocumentRevisionId,
    sourceFingerprint: 'a'.repeat(64),
  },
}

const manifest = (entries = [
  ['a'.repeat(64), OBSERVER_FUNCTION_NAME],
  ['b'.repeat(64), SAVE_DRAFT_FUNCTION_NAME],
]) => `const manifest = {\n${entries.map(([id, name]) => `  "${id}": {\n    functionName: "${name}",\n    importer: () => import("./fake.mjs")\n  }`).join(',\n')}\n};`

function driver(options = {}) {
  return createIsolatedLifecycleHttpDriver({
    backendRef: ISOLATED_BACKEND_REF,
    origin,
    approvedOrigin: origin,
    fetchImpl: vi.fn(),
    manifestSource: manifest(),
    ...options,
  })
}

function response(body = '{}', status = 200) {
  return new Response(body, { status, headers: { 'content-type': 'application/json' } })
}

describe('isolated lifecycle HTTP driver', () => {
  it('discovers the reviewed observer and SaveDraft endpoint IDs only from generated manifest metadata', () => {
    expect(discoverServerFunctionEndpoint(manifest())).toEqual({
      id: 'a'.repeat(64), path: `/_serverFn/${'a'.repeat(64)}`, functionName: OBSERVER_FUNCTION_NAME,
    })
    expect(discoverServerFunctionEndpoint(manifest(), SAVE_DRAFT_FUNCTION_NAME).id).toBe('b'.repeat(64))
  })

  it('discovers the observer from a byte-accurate generated resolver manifest sample', async () => {
    const sample = `const manifest = {
  "5efade5faa12cd0aec505599c83bdee2c44729c7e4483ed0f3bda06664ff70de": {
    functionName: "getLifecycleDeploymentObservation_createServerFn_handler",
    importer: () => import("./_ssr/lifecycle-deployment-observation.functions-BiXKczWy.mjs")
  },
  "${'b'.repeat(64)}": {
    functionName: "generateLifecycleDocumentDraft_createServerFn_handler",
    importer: () => import("./_ssr/lifecycle-actions.functions-example.mjs")
  }
};`
    const endpoint = await discoverServerFunctionEndpointFromGeneratedBuild({
      manifestDirectory: 'dist/server',
      readDirImpl: async () => ['__23tanstack-start-server-fn-resolver-BYw-djmU.mjs'],
      readFileImpl: async (path) => {
        expect(path).toBe('dist/server/__23tanstack-start-server-fn-resolver-BYw-djmU.mjs')
        return sample
      },
    })
    expect(endpoint).toEqual({ id: '5efade5faa12cd0aec505599c83bdee2c44729c7e4483ed0f3bda06664ff70de', path: '/_serverFn/5efade5faa12cd0aec505599c83bdee2c44729c7e4483ed0f3bda06664ff70de', functionName: OBSERVER_FUNCTION_NAME })
  })

  it('uses only the manifest-resolved authenticated SaveDraft server-function transport', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(response())
    const subject = driver({ fetchImpl })
    await subject.invokeSaveDraft({ session, data: payload })
    expect(fetchImpl).toHaveBeenCalledWith(`${origin}/_serverFn/${'b'.repeat(64)}`, expect.objectContaining({
      method: 'POST',
      redirect: 'error',
      headers: expect.objectContaining({ authorization: `Bearer ${session}`, 'x-tsr-serverFn': 'true', accept: 'application/json' }),
      body: JSON.stringify({ data: payload }),
    }))
    const request = fetchImpl.mock.calls[0][1]
    expect(request.body).not.toContain('actorId')
    expect(request.body).not.toContain('service')
  })

  it('fails closed when a manifest cannot resolve the observer endpoint', async () => {
    const subject = driver({ manifestSource: manifest([['b'.repeat(64), SAVE_DRAFT_FUNCTION_NAME]]) })
    const readiness = await subject.inspectReadiness({ session, ...observerInput })
    expect(readiness.deployed.actorGateway).toBeUndefined()
    expect(readiness.capabilities.deploymentObservation).toEqual({ status: 'BLOCKED', missingContract: 'generated_observer_endpoint_unresolved' })
  })

  it('uses the real observer wire format and propagates partial BLOCKED capabilities', async () => {
    const reported = {
      status: 'BLOCKED', backendRef: ISOLATED_BACKEND_REF, missingContract: 'physical_storage_and_audit_readback_contract',
      capabilities: {
        actorGateway: { status: 'BLOCKED', reason: 'no_read_only_actor_gateway_contract' },
        rpcSchema: { status: 'BLOCKED', reason: 'no_read_only_rpc_catalog_contract' },
        projectDriveStorage: { status: 'BLOCKED', reason: 'physical_upload_download_not_observable' },
        observabilityReadback: { status: 'OBSERVED' },
      },
    }
    const fetchImpl = vi.fn().mockResolvedValue(response(JSON.stringify(reported)))
    const subject = driver({ fetchImpl })
    const readiness = await subject.inspectReadiness({ session, ...observerInput })
    expect(fetchImpl).toHaveBeenCalledWith(`${origin}/_serverFn/${'a'.repeat(64)}`, expect.objectContaining({
      method: 'POST', redirect: 'error', body: JSON.stringify({ data: { backendRef: ISOLATED_BACKEND_REF, ...observerInput } }),
    }))
    expect(readiness.authorizeLifecycleDocumentDraft).toBe(false)
    expect(readiness.observabilityReadback).toBe(false)
    expect(readiness.capabilities.observabilityReadback).toEqual({ status: 'OBSERVED' })
    expect(readiness.capabilities.projectDriveStorage.status).toBe('BLOCKED')
  })

  it('marks source exactness unverified without template, revision, and fingerprint evidence', async () => {
    const subject = driver()
    const readiness = await subject.inspectReadiness({ session, projectId: payload.projectId, requestKey: payload.requestKey })
    expect(readiness.capabilities.observabilityReadback).toEqual({ status: 'BLOCKED', missingContract: 'source_exactness_unverified' })
  })

  it('redacts sessions from application transport failures and denials', async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new Error(`network failed Authorization: Bearer ${session}`))
    const subject = driver({ fetchImpl })
    await expect(subject.invokeSaveDraft({ session, data: payload })).rejects.toMatchObject({ code: 'TRANSPORT_FAILURE' })
    try { await subject.invokeSaveDraft({ session, data: payload }) } catch (error) {
      expect(error.message).not.toContain(session)
      expect(error.cause).not.toContain(session)
    }
  })

  it.each([
    ['origin mismatch', { approvedOrigin: 'https://another.example.test' }, 'ORIGIN_MISMATCH'],
    ['redirected response', {}, 'REDIRECT_OR_OFF_ORIGIN'],
  ])('rejects %s without forwarding authenticated transport', async (name, options, code) => {
    const fetchImpl = name === 'redirected response'
      ? vi.fn().mockResolvedValue({ ok: true, redirected: true, url: 'https://attacker.example.test', json: async () => ({}) })
      : vi.fn()
    if (name === 'origin mismatch') {
      expect(() => driver({ fetchImpl, ...options })).toThrow(expect.objectContaining({ code }))
    } else {
      await expect(driver({ fetchImpl }).inspectReadiness({ session, ...observerInput })).resolves.toMatchObject({ capabilities: { deploymentObservation: { status: 'BLOCKED' } } })
      expect(fetchImpl.mock.calls[0][1].headers.authorization).toBe(`Bearer ${session}`)
    }
  })

  it('treats direct composite RPC transport as unsupported rather than bypassing through actor input', async () => {
    const subject = driver()
    expect(subject.executeLifecycleDocumentAction).toBeUndefined()
    await expect(subject.runMutationCases()).rejects.toMatchObject({ code: 'MUTATION_CASES_BLOCKED' })
  })

  it('reads saved bytes and verifies their SHA256 before reporting a live save', async () => {
    const bytes = new TextEncoder().encode('immutable saved draft')
    const hash = '7377bf9df731b6622701e416798f336450faadb62312399d212df6f0b51f0b45'
    const subject = driver()
    const result = await subject.readSavedFileAndVerify({ signedDownloadUrl: 'https://download.example.test/file', expectedSha256: hash, fetchFile: vi.fn().mockResolvedValue(new Response(bytes)) })
    expect(result).toEqual({ byteLength: bytes.byteLength, sha256: hash })
    await expect(subject.readSavedFileAndVerify({ signedDownloadUrl: 'https://download.example.test/file', expectedSha256: '0'.repeat(64), fetchFile: vi.fn().mockResolvedValue(new Response(bytes)) })).rejects.toMatchObject({ code: 'HASH_MISMATCH' })
  })
})

describe('isolated driver error boundary', () => {
  it('redacts bearer and key-shaped values without retaining tokens', () => {
    const message = redactSensitive(`Authorization: Bearer ${session} sb_secret_real-secret`)
    expect(message).toContain('[REDACTED]')
    expect(message).not.toContain(session)
    expect(message).not.toContain('sb_secret_real-secret')
    expect(new IsolatedDriverError('X', `Bearer ${session}`).message).not.toContain(session)
  })
})
