import { describe, expect, it, vi } from 'vitest'
import {
  BLOCKED_DEPLOYMENT_OBSERVATION,
  ISOLATED_BACKEND_REF,
  IsolatedDriverError,
  LIFECYCLE_SAVE_DRAFT_PATH,
  createIsolatedLifecycleHttpDriver,
  redactSensitive,
} from './lifecycle_document_draft_isolated_http_driver.mjs'

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

function response(body = '{}', status = 200) {
  return new Response(body, { status, headers: { 'content-type': 'application/json' } })
}

describe('isolated lifecycle HTTP driver', () => {
  it('uses only the authenticated protected SaveDraft server-function transport', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(response())
    const driver = createIsolatedLifecycleHttpDriver({ backendRef: ISOLATED_BACKEND_REF, origin, fetchImpl })
    await driver.invokeSaveDraft({ session, data: payload })
    expect(fetchImpl).toHaveBeenCalledWith(`${origin}${LIFECYCLE_SAVE_DRAFT_PATH}`, expect.objectContaining({
      method: 'POST',
      headers: expect.objectContaining({ authorization: `Bearer ${session}`, 'x-tsr-serverFn': 'true' }),
      body: JSON.stringify({ data: payload }),
    }))
    const request = fetchImpl.mock.calls[0][1]
    expect(request.body).not.toContain('actorId')
    expect(request.body).not.toContain('service')
  })

  it('fails closed with exact blocked deployment contracts when no safe observation adapter exists', async () => {
    const driver = createIsolatedLifecycleHttpDriver({ backendRef: ISOLATED_BACKEND_REF, origin, fetchImpl: vi.fn() })
    const readiness = await driver.inspectReadiness()
    expect(readiness.deployed.actorGateway).toBeUndefined()
    expect(readiness.capabilities.rpcSchema).toEqual({ status: 'BLOCKED', missingContract: BLOCKED_DEPLOYMENT_OBSERVATION })
    expect(readiness.capabilities.projectDriveStorage.status).toBe('BLOCKED')
  })

  it('does not accept declaration flags from an unverified observation adapter', async () => {
    const driver = createIsolatedLifecycleHttpDriver({ backendRef: ISOLATED_BACKEND_REF, origin, fetchImpl: vi.fn(), observationAdapter: {
      inspect: vi.fn().mockResolvedValue({ backendRef: ISOLATED_BACKEND_REF, verified: false, actorGateway: 'execute_lifecycle_document_action' }),
    } })
    const readiness = await driver.inspectReadiness()
    expect(readiness.authorizeLifecycleDocumentDraft).toBe(false)
    expect(readiness.capabilities.deploymentObservation).toEqual({ status: 'BLOCKED', missingContract: BLOCKED_DEPLOYMENT_OBSERVATION })
  })

  it('redacts sessions from application transport failures and denials', async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new Error(`network failed Authorization: Bearer ${session}`))
    const driver = createIsolatedLifecycleHttpDriver({ backendRef: ISOLATED_BACKEND_REF, origin, fetchImpl })
    await expect(driver.invokeSaveDraft({ session, data: payload })).rejects.toMatchObject({ code: 'TRANSPORT_FAILURE' })
    try { await driver.invokeSaveDraft({ session, data: payload }) } catch (error) {
      expect(error.message).not.toContain(session)
      expect(error.cause).not.toContain(session)
    }
  })

  it('treats direct composite RPC transport as unsupported rather than bypassing through actor input', async () => {
    const driver = createIsolatedLifecycleHttpDriver({ backendRef: ISOLATED_BACKEND_REF, origin, fetchImpl: vi.fn() })
    expect(driver.executeLifecycleDocumentAction).toBeUndefined()
    await expect(driver.runMutationCases()).rejects.toMatchObject({ code: 'MUTATION_CASES_BLOCKED' })
  })

  it('reads saved bytes and verifies their SHA256 before reporting a live save', async () => {
    const bytes = new TextEncoder().encode('immutable saved draft')
    const hash = '4af7e7a28b2864b0182edb7f41bf4b876a134a41748d8916f745714142ea58aa'
    const driver = createIsolatedLifecycleHttpDriver({ backendRef: ISOLATED_BACKEND_REF, origin, fetchImpl: vi.fn() })
    const result = await driver.readSavedFileAndVerify({ signedDownloadUrl: 'https://download.example.test/file', expectedSha256: hash, fetchFile: vi.fn().mockResolvedValue(new Response(bytes)) })
    expect(result).toEqual({ byteLength: bytes.byteLength, sha256: hash })
    await expect(driver.readSavedFileAndVerify({ signedDownloadUrl: 'https://download.example.test/file', expectedSha256: '0'.repeat(64), fetchFile: vi.fn().mockResolvedValue(new Response(bytes)) })).rejects.toMatchObject({ code: 'HASH_MISMATCH' })
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
