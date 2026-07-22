import React, { useState } from "react";
import { Link } from "react-router-dom";
import { Code2, Copy, Check, KeyRound, AlertTriangle, ArrowLeft, Loader2 } from "lucide-react";
import { useActor } from "@/hooks/useActor";

function CopyButton({ text }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={() => {
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
      className="p-1.5 rounded-xl hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
      aria-label="Copy to clipboard"
    >
      {copied ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
    </button>
  );
}

function CodeBlock({ children }) {
  return (
    <pre className="bg-slate-950/80 border border-slate-800 rounded-lg p-4 text-xs text-slate-300 overflow-x-auto whitespace-pre">
      {children}
    </pre>
  );
}

export default function DeveloperPortal() {
  const { actor } = useActor();
  const [name, setName] = useState("");
  const [website, setWebsite] = useState("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  // Set once after successful registration: { clientId, apiKey }
  const [credentials, setCredentials] = useState(null);

  const apiBase = "https://<canister-id>.raw.icp0.io";

  const handleRegister = async (e) => {
    e.preventDefault();
    if (!actor) { setError("Cannot connect to the blockchain. Please try again."); return; }
    setLoading(true);
    setError("");
    try {
      const result = await actor.register_api_client(name.trim(), website.trim(), email.trim());
      if (result && "Ok" in result) {
        const [clientId, apiKey] = result.Ok;
        setCredentials({ clientId, apiKey });
      } else {
        setError(result?.Err || "Registration failed. Please try again.");
      }
    } catch (err) {
      setError(err?.message || "Registration failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="dark min-h-screen app-bg text-white py-10 px-4">
      <div className="max-w-3xl mx-auto">
        <Link to="/" className="flex items-center gap-2 text-sm text-slate-400 hover:text-slate-200 mb-6">
          <ArrowLeft className="w-4 h-4" /> Back
        </Link>

        <div className="flex items-center gap-3 mb-2">
          <div className="w-12 h-12 rounded-xl bg-brand-500/15 ring-1 ring-brand-400/30 flex items-center justify-center">
            <Code2 className="w-6 h-6 text-brand-300" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Developer Portal</h1>
            <p className="text-sm text-slate-400">Add identity verification to your website with our KYC API</p>
          </div>
        </div>

        {/* Registration / credentials */}
        <div className="content-card mt-6">
          {credentials ? (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-green-400 font-semibold">
                <Check className="w-5 h-5" /> Registration received
              </div>
              <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3 flex gap-2 text-sm text-yellow-300">
                <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <span>
                  Save your API key now — it is shown <strong>only once</strong> and cannot be recovered.
                  Your key stays <strong>inactive until an admin approves</strong> your registration.
                </span>
              </div>
              <div>
                <p className="text-xs text-slate-400 mb-1">Client ID</p>
                <div className="flex items-center gap-2 bg-slate-950/60 border border-slate-800 rounded-lg px-3 py-2">
                  <code className="text-sm text-slate-200 flex-1 break-all">{credentials.clientId}</code>
                  <CopyButton text={credentials.clientId} />
                </div>
              </div>
              <div>
                <p className="text-xs text-slate-400 mb-1">API Key (secret — store securely)</p>
                <div className="flex items-center gap-2 bg-slate-950/60 border border-slate-800 rounded-lg px-3 py-2">
                  <code className="text-sm text-brand-300 flex-1 break-all">{credentials.apiKey}</code>
                  <CopyButton text={credentials.apiKey} />
                </div>
              </div>
            </div>
          ) : (
            <form onSubmit={handleRegister} className="space-y-4">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <KeyRound className="w-5 h-5 text-brand-300" /> Get an API key
              </h2>
              <div>
                <label htmlFor="dev-name" className="block text-sm text-slate-300 mb-1">Company / project name</label>
                <input id="dev-name" type="text" value={name} onChange={e => setName(e.target.value)}
                  maxLength={100} required placeholder="Acme Exchange" className="input-field" />
              </div>
              <div>
                <label htmlFor="dev-website" className="block text-sm text-slate-300 mb-1">Website URL</label>
                <input id="dev-website" type="url" value={website} onChange={e => setWebsite(e.target.value)}
                  maxLength={200} required placeholder="https://acme.example" className="input-field" />
              </div>
              <div>
                <label htmlFor="dev-email" className="block text-sm text-slate-300 mb-1">Contact email</label>
                <input id="dev-email" type="email" value={email} onChange={e => setEmail(e.target.value)}
                  maxLength={254} required placeholder="dev@acme.example" className="input-field" />
              </div>
              {error && <p className="text-sm text-red-400">{error}</p>}
              <button type="submit" disabled={loading || !name || !website || !email} className="btn-primary w-full min-h-[44px]">
                {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Registering…</> : "Register & Generate Key"}
              </button>
              <p className="text-xs text-slate-500">
                Registrations are reviewed by our team. Your key becomes active once approved.
              </p>
            </form>
          )}
        </div>

        {/* API documentation */}
        <div className="content-card mt-6 space-y-6">
          <h2 className="text-lg font-semibold">API Reference</h2>
          <p className="text-sm text-slate-400 -mt-3">
            Base URL: <code className="text-brand-300">{apiBase}</code> — authenticate every call with{" "}
            <code className="text-brand-300">Authorization: Bearer &lt;api_key&gt;</code>. Call from your backend only;
            never expose your key in browser code.
          </p>

          <div>
            <h3 className="text-sm font-semibold text-white mb-1">1. Create a verification session</h3>
            <p className="text-xs text-slate-400 mb-2">Returns a hosted URL — redirect your user there to complete KYC.</p>
            <CodeBlock>{`curl -X POST ${apiBase}/api/v1/sessions \\
  -H "Authorization: Bearer kyc_live_..." \\
  -H "Content-Type: application/json"

# 201 Created
{
  "session_id": "api_3f8a...",
  "verification_url": "https://kyc.example/verify/api_3f8a...",
  "expires_in_seconds": 86400
}`}</CodeBlock>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-white mb-1">2. Redirect your user</h3>
            <p className="text-xs text-slate-400 mb-2">
              Send the user to <code className="text-brand-300">verification_url</code>. They scan their ID, pass an
              active-liveness face check, and confirm their details. Sessions expire after 24 hours.
            </p>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-white mb-1">3. Poll for the result</h3>
            <CodeBlock>{`curl ${apiBase}/api/v1/sessions/api_3f8a... \\
  -H "Authorization: Bearer kyc_live_..."

# 200 OK
{
  "session_id": "api_3f8a...",
  "status": "completed",          // waiting | in_progress | completed | expired
  "result": {
    "face_verified": true,
    "full_name": "Ahmed Mohamed Ali",
    "national_id_last4": "4567",
    "review_status": "approved"   // pending_review | approved | rejected
  }
}`}</CodeBlock>
          </div>

          <div className="text-xs text-slate-500 space-y-1">
            <p>• Rate limit: 100 session creations per hour per client.</p>
            <p>• <code>review_status</code> updates when our compliance team reviews the submission — keep polling or re-check later.</p>
            <p>• Only minimal data is exposed: full name, last 4 digits of the national ID, and verification flags.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
