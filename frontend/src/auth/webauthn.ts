export function toBuffer(b64url: string): ArrayBuffer {
  const pad = '='.repeat((4 - (b64url.length % 4)) % 4)
  const b64 = (b64url + pad).replace(/-/g, '+').replace(/_/g, '/')
  const bin = atob(b64)
  const buf = new ArrayBuffer(bin.length)
  const view = new Uint8Array(buf)
  for (let i = 0; i < bin.length; i++) view[i] = bin.charCodeAt(i)
  return buf
}

export function toB64url(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf)
  let bin = ''
  for (let i = 0; i < bytes.byteLength; i++) bin += String.fromCharCode(bytes[i])
  const b64 = btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
  return b64
}

export function mapCreationOptions(opts: any): PublicKeyCredentialCreationOptions {
  return {
    ...opts,
    challenge: toBuffer(opts.challenge),
    user: {
      ...opts.user,
      id: toBuffer(opts.user.id),
    },
    excludeCredentials: (opts.excludeCredentials || []).map((c: any) => ({ ...c, id: toBuffer(c.id) })),
  } as any
}

export function mapRequestOptions(opts: any): PublicKeyCredentialRequestOptions {
  return {
    ...opts,
    challenge: toBuffer(opts.challenge),
    allowCredentials: (opts.allowCredentials || []).map((c: any) => ({ ...c, id: toBuffer(c.id) })),
  } as any
}

export function attestationToJSON(cred: PublicKeyCredential): any {
  const r = (cred as any).response as AuthenticatorAttestationResponse
  return {
    id: (cred as any).id,
    rawId: toB64url((cred as any).rawId),
    type: cred.type,
    response: {
      clientDataJSON: toB64url(r.clientDataJSON),
      attestationObject: toB64url(r.attestationObject),
      transports: (r as any).getTransports ? (r as any).getTransports() : undefined,
    },
  }
}

export function assertionToJSON(cred: PublicKeyCredential): any {
  const r = (cred as any).response as AuthenticatorAssertionResponse
  return {
    id: (cred as any).id,
    rawId: toB64url((cred as any).rawId),
    type: cred.type,
    response: {
      clientDataJSON: toB64url(r.clientDataJSON),
      authenticatorData: toB64url(r.authenticatorData),
      signature: toB64url(r.signature),
      userHandle: r.userHandle ? toB64url(r.userHandle) : undefined,
    },
  }
}

export async function detectPasskeyAvailable(): Promise<boolean> {
  const hasCred = typeof navigator !== 'undefined' && 'credentials' in navigator
  const hasPKC = typeof window !== 'undefined' && 'PublicKeyCredential' in window
  const secureOK = typeof window !== 'undefined' && (window.isSecureContext || ['localhost', '127.0.0.1', '::1'].includes(window.location.hostname))
  if (!hasCred || !hasPKC || !secureOK) return false
  try {
    if (typeof (window as any).PublicKeyCredential?.isUserVerifyingPlatformAuthenticatorAvailable === 'function') {
      return await (window as any).PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable()
    }
  } catch {
    // ignore and fallback to basic capability
  }
  return true
}
