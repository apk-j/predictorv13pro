const fs = require('fs')
const crypto = require('crypto')

function usage() {
  console.error('Usage: node scripts/generateSecurityCredential.js <certPath> <initiatorPassword>')
  process.exit(1)
}

const [certPath, initiatorPassword] = process.argv.slice(2)
if (!certPath || !initiatorPassword) usage()

try {
  const certPem = fs.readFileSync(certPath, 'utf8')
  const cipher = crypto.publicEncrypt({ key: certPem, padding: crypto.constants.RSA_PKCS1_PADDING }, Buffer.from(initiatorPassword, 'utf8'))
  process.stdout.write(cipher.toString('base64'))
} catch (e) {
  console.error('Failed to generate SecurityCredential:', e && e.message ? e.message : e)
  process.exit(2)
}