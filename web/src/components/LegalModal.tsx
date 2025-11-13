import React from 'react'
import { createPortal } from 'react-dom'

export const LegalModal: React.FC<{ open: boolean; onClose: () => void; type: 'privacy' | 'terms' }>
 = ({ open, onClose, type }) => {
  if (!open) return null

  const Privacy = () => (
    <div>
      <h3>Privacy Policy</h3>
      <p style={{ fontSize: 14, color: '#444' }}>Last updated: 2025-11-05</p>

      <p style={{ fontSize: 14, color: '#444' }}>
        We value your privacy. This policy explains what data we collect, how we use it,
        and the choices you have. It applies to the Aviator Predictor V13 Pro application and related services.
      </p>

      <h4>Information We Collect</h4>
      <ul style={{ fontSize: 14, color: '#444' }}>
        <li>Account data: email address and password (hashed).</li>
        <li>Subscription data: status, transaction references from payment providers.</li>
        <li>Usage data: basic interaction logs, device and app version (for diagnostics).</li>
        <li>Connection data: selected betting site and connection status.</li>
      </ul>

      <h4>How We Use Your Information</h4>
      <ul style={{ fontSize: 14, color: '#444' }}>
        <li>To provide and improve predictions and connectors.</li>
        <li>To authenticate users and manage subscriptions.</li>
        <li>To ensure security, prevent fraud, and troubleshoot issues.</li>
        <li>To comply with legal obligations.</li>
      </ul>

      <h4>Legal Bases</h4>
      <p style={{ fontSize: 14, color: '#444' }}>
        We process personal data on the basis of consent, contract performance, legitimate interests, and legal obligations.
      </p>

      <h4>Data Sharing</h4>
      <p style={{ fontSize: 14, color: '#444' }}>
        We do not sell personal data. We share data only with trusted processors necessary to deliver the service,
        such as payment providers and hosting. All processors are bound by contractual and security obligations.
      </p>

      <h4>Security</h4>
      <p style={{ fontSize: 14, color: '#444' }}>
        We use industry-standard measures to protect your data, including encryption in transit (HTTPS), hashed passwords,
        and access controls. No system is completely secure; we continuously improve our safeguards.
      </p>

      <h4>Retention</h4>
      <p style={{ fontSize: 14, color: '#444' }}>
        We retain data only as long as necessary for the purposes described or as required by law.
      </p>

      <h4>Your Rights</h4>
      <ul style={{ fontSize: 14, color: '#444' }}>
        <li>Access, rectification, deletion, and portability of your data.</li>
        <li>Object to or restrict processing in certain cases.</li>
        <li>Withdraw consent where processing relies on consent.</li>
      </ul>
      <p style={{ fontSize: 14, color: '#444' }}>
        To exercise rights, contact: 
        <a href="mailto:support@aviatorwin.co.ke" style={{ color: '#0b5ed7', textDecoration: 'underline' }}>support@aviatorpredictorv13pro.com</a>.
      </p>

      <h4>International Transfers</h4>
      <p style={{ fontSize: 14, color: '#444' }}>
        If data is transferred across borders, we use appropriate safeguards such as standard contractual clauses.
      </p>

      <h4>Children’s Privacy</h4>
      <p style={{ fontSize: 14, color: '#444' }}>
        Our services are not directed to individuals under the age of 18. We do not knowingly collect data from children.
      </p>

      <h4>Cookies</h4>
      <p style={{ fontSize: 14, color: '#444' }}>
        We use minimal cookies and local storage to operate the app (e.g., session tokens). You can control cookies in your browser.
      </p>

      <h4>Changes</h4>
      <p style={{ fontSize: 14, color: '#444' }}>
        We may update this policy. We will notify you of significant changes within the app.
      </p>
    </div>
  )

  const Terms = () => (
    <div>
      <h3>Terms of Service</h3>
      <p style={{ fontSize: 14, color: '#444' }}>Last updated: 2025-11-05</p>

      <p style={{ fontSize: 14, color: '#444' }}>
        By using Aviator Predictor V13 Pro, you agree to these Terms. If you do not agree, do not use the service.
      </p>

      <h4>Service</h4>
      <p style={{ fontSize: 14, color: '#444' }}>
        We provide prediction features and connectors to third‑party betting sites. We do not operate or control those sites.
      </p>

      <h4>Eligibility</h4>
      <p style={{ fontSize: 14, color: '#444' }}>
        You must be at least 18 years old and comply with applicable laws in your jurisdiction.
      </p>

      <h4>Accounts and Security</h4>
      <p style={{ fontSize: 14, color: '#444' }}>
        Keep your credentials secure. You are responsible for all activity under your account.
      </p>

      <h4>Subscriptions and Payments</h4>
      <p style={{ fontSize: 14, color: '#444' }}>
        Subscriptions grant access to premium features. Fees, billing cycles, and refund policies are disclosed at checkout.
        By subscribing, you authorize charges to your selected payment method.
      </p>

      <h4>License and Use</h4>
      <ul style={{ fontSize: 14, color: '#444' }}>
        <li>We grant you a personal, non‑transferable, revocable license to use the app.</li>
        <li>Do not reverse engineer, scrape, or misuse the service.</li>
        <li>Do not attempt to bypass access controls or interfere with operations.</li>
      </ul>

      <h4>User Responsibilities</h4>
      <ul style={{ fontSize: 14, color: '#444' }}>
        <li>Use the service responsibly and lawfully.</li>
        <li>Respect third‑party site terms; we are not affiliated with them.</li>
      </ul>

      <h4>Intellectual Property</h4>
      <p style={{ fontSize: 14, color: '#444' }}>
        The app, brand, and content are protected by intellectual property laws. No rights are transferred except as expressly granted.
      </p>

      <h4>Third‑Party Services</h4>
      <p style={{ fontSize: 14, color: '#444' }}>
        Links to third‑party sites are provided for convenience. We are not responsible for their content, availability, or policies.
      </p>

      <h4>Disclaimers</h4>
      <p style={{ fontSize: 14, color: '#444' }}>
        Predictions are generated by algorithms and, where technically feasible, reflect real‑time telemetry from the connected betting site.
      </p>

      <h4>Limitation of Liability</h4>
      <p style={{ fontSize: 14, color: '#444' }}>
        To the maximum extent permitted by law, we are not liable for indirect, incidental, or consequential damages.
      </p>

      <h4>Indemnification</h4>
      <p style={{ fontSize: 14, color: '#444' }}>
        You agree to indemnify us against claims arising from your use of the service or violation of these Terms.
      </p>

      <h4>Termination</h4>
      <p style={{ fontSize: 14, color: '#444' }}>
        We may suspend or terminate access for violations or security risks. You may stop using the app at any time.
      </p>

      <h4>Governing Law and Dispute Resolution</h4>
      <p style={{ fontSize: 14, color: '#444' }}>
        These Terms are governed by applicable laws at our principal place of business. Disputes will be resolved through amicable negotiation or,
        if necessary, binding arbitration, unless prohibited by local law.
      </p>

      <h4>Changes</h4>
      <p style={{ fontSize: 14, color: '#444' }}>
        We may update these Terms. Continued use after changes indicates acceptance.
      </p>

      <h4>Contact</h4>
      <p style={{ fontSize: 14, color: '#444' }}>
        Questions? Contact: 
        <a href="mailto:support@aviatorwin.co.ke" style={{ color: '#0b5ed7', textDecoration: 'underline' }}>support@aviatorpredictorv13pro.com</a>.
      </p>
    </div>
  )

  return createPortal(
    <div className="modal modal--legal">
      <div className="modal-card">
        {type === 'privacy' ? <Privacy /> : <Terms />}
        <div className="modal-actions">
          <button className="btn" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>,
    document.body
  )
 }