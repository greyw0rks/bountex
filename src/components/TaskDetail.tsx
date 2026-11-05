import { useEffect, useState } from 'react';
import {
  ArrowRight,
  Check,
  CheckCheck,
  Clock3,
  ExternalLink,
  FileText,
  Info,
  Link2,
  ShieldCheck,
  Upload,
  Wallet,
  X,
} from 'lucide-react';
import { api } from '../lib/api';
import { nim, short, statusLabels, type Evidence, type Task } from '../lib/types';
import { CategoryIcon, daysLeft } from './TaskCard';
export function TaskDetail({
  task,
  address,
  preview,
  busy,
  onAction,
  onConnect,
}: {
  task: Task;
  address?: string;
  preview: boolean;
  busy: boolean;
  onAction: (action: string, body?: Record<string, unknown>) => Promise<void>;
  onConnect: () => void;
}) {
  const key = `bountex-draft:${task.id}`;
  const [note, setNote] = useState(''),
    [url, setUrl] = useState(''),
    [files, setFiles] = useState<File[]>([]),
    [feedback, setFeedback] = useState(''),
    [error, setError] = useState(''),
    [uploading, setUploading] = useState(false),
    [confirmPay, setConfirmPay] = useState(false);
  const [removedFiles, setRemovedFiles] = useState<string[]>([]);
  const keptFiles = (task.evidence?.files || []).filter((f) => !removedFiles.includes(f.path));
  const owner = address === task.creator,
    worker = address === task.worker;
  const [reportReason, setReportReason] = useState(''),
    [recoveryHash, setRecoveryHash] = useState(() => {
      try {
        return JSON.parse(localStorage.getItem(`bountex-payment:${task.id}`) || '{}').hash || '';
      } catch {
        return '';
      }
    });
  useEffect(() => {
    try {
      const d = JSON.parse(localStorage.getItem(key) || '{}');
      setNote(d.note ?? task.evidence?.note ?? '');
      setUrl(d.url ?? task.evidence?.url ?? '');
    } catch {}
  }, [key, task.evidence]);
  const draft = (n: string, u: string) => {
    setNote(n);
    setUrl(u);
    localStorage.setItem(key, JSON.stringify({ note: n, url: u }));
  };
  async function act(action: string, body?: Record<string, unknown>) {
    setError('');
    try {
      await onAction(action, body);
    } catch (err) {
      setError((err as Error).message);
    }
  }
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (note.trim().length < 20) {
      setError('Add at least 20 characters explaining what you completed.');
      return;
    }
    if (!url && !files.length && !keptFiles.length) {
      setError('Add a proof link or at least one attachment.');
      return;
    }
    if (url && !/^https:\/\//i.test(url)) {
      setError('Use an https:// link for your evidence.');
      return;
    }
    setUploading(true);
    try {
      const uploaded = preview
        ? files.map((f) => ({ name: f.name, path: `preview/${f.name}`, size: f.size }))
        : await Promise.all(files.map((f) => api.upload(task.id, f)));
      const evidence: Evidence = {
        note: note.trim(),
        url,
        files: [...keptFiles, ...uploaded],
        submittedAt: new Date().toISOString(),
      };
      await onAction('submit', { evidence });
      setFiles([]);
      setRemovedFiles([]);
      localStorage.removeItem(key);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setUploading(false);
    }
  }
  function selectFiles(selected: FileList | null) {
    if (!selected) return;
    const list = [...selected];
    if (list.some((f) => f.size > 10 * 1024 * 1024)) {
      setError('Each attachment must be 10 MB or smaller.');
      return;
    }
    if (files.length + list.length + keptFiles.length > 5) {
      setError('Attach up to 5 files.');
      return;
    }
    setFiles((old) => [...old, ...list]);
  }
  const steps = ['claimed', 'submitted', 'approved', 'paid'];
  const active = task.status === 'revision' ? 1 : steps.indexOf(task.status);
  return (
    <div className="detail-content">
      <div className="detail-meta">
        <span className={`category-pill ${task.category.toLowerCase()}`}>
          <CategoryIcon category={task.category} size={13} />
          {task.category}
        </span>
        <span className={`status-badge status-${task.status}`}>
          <span />
          {statusLabels[task.status]}
        </span>
      </div>
      <h3 className="detail-title">{task.title}</h3>
      <div className="detail-reward">
        <div>
          <span className="eyebrow">OFFERED REWARD</span>
          <strong>
            <span className="nim-mark" />
            {nim(task.rewardLuna)} <span>NIM</span>
          </strong>
        </div>
        <div className="detail-timing">
          <span>
            <Clock3 size={14} />
            {task.minutes} min estimated
          </span>
          <span>{daysLeft(task.deadline)}</span>
          <span className="exact-deadline">
            Due{' '}
            {new Date(task.deadline).toLocaleString(undefined, {
              month: 'short',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
              timeZoneName: 'short',
            })}
          </span>
        </div>
      </div>
      {task.worker && (
        <div className="lifecycle">
          {steps.map((s, i) => (
            <div key={s} className={i <= active ? 'complete' : ''}>
              <span>{i < active ? <Check size={12} /> : i + 1}</span>
              <small>{['Working', 'Review', 'Approved', 'Paid'][i]}</small>
            </div>
          ))}
        </div>
      )}
      <div className="detail-section">
        <h4>The mission</h4>
        <p className="task-full-description">{task.description}</p>
      </div>
      <div className="detail-section">
        <h4>What to submit</h4>
        <ul className="check-list">
          {task.requirements.map((r, i) => (
            <li key={i}>
              <span>
                <Check size={12} />
              </span>
              {r}
            </li>
          ))}
        </ul>
      </div>
      <div className="detail-creator">
        <span className={`avatar ${task.category.toLowerCase()}`}>{task.avatar}</span>
        <div>
          <strong>{task.creatorName}</strong>
          <span>{preview ? 'Sample creator' : short(task.creator)}</span>
        </div>
        <span className="creator-tag">Task creator</span>
      </div>
      {task.feedback && (
        <div className="feedback-box">
          <h4>{task.status === 'revision' ? 'A little more work needed' : 'Creator’s review'}</h4>
          <p>{task.feedback}</p>
        </div>
      )}
      {task.evidence && (
        <div className="evidence-box">
          <div className="section-label">
            <FileText size={16} />
            <h4>Submitted work</h4>
          </div>
          <p>{task.evidence.note}</p>
          {task.evidence.url && (
            <a href={task.evidence.url} target="_blank" rel="noreferrer" className="evidence-link">
              <Link2 size={14} />
              View evidence
              <ExternalLink size={12} />
            </a>
          )}
          {task.evidence.files.map((f, i) => (
            <button
              key={i}
              className="attachment-link"
              onClick={async () => {
                if (preview) {
                  setError(
                    'Preview attachments are sample metadata. Upload in live mode to store files.',
                  );
                  return;
                }
                try {
                  const r = await api.evidenceUrl(task.id, f.path);
                  window.open(r.url, '_blank', 'noopener,noreferrer');
                } catch (e) {
                  setError((e as Error).message);
                }
              }}
            >
              <FileText size={14} />
              {f.name}
              <ExternalLink size={12} />
            </button>
          ))}
        </div>
      )}
      {worker && (task.status === 'claimed' || task.status === 'revision') && (
        <form className="submission-form" onSubmit={submit}>
          <h4>Make your work count.</h4>
          <p>Share your result and show how it meets the requirements.</p>
          <label>
            Your submission
            <textarea
              rows={4}
              value={note}
              onChange={(e) => draft(e.target.value, url)}
              placeholder="Here’s what I completed…"
              minLength={20}
              maxLength={5000}
              required
            />
          </label>
          <label>
            Proof link
            <input
              type="url"
              value={url}
              onChange={(e) => draft(note, e.target.value)}
              placeholder="https://figma.com/your-work"
            />
          </label>
          <label className="upload-zone">
            <Upload size={22} />
            <strong>Add supporting files</strong>
            <span>Images, PDF, text · Up to 10 MB each</span>
            <input
              type="file"
              multiple
              accept="image/png,image/jpeg,image/webp,application/pdf,text/plain"
              onChange={(e) => selectFiles(e.target.files)}
            />
          </label>
          {keptFiles.map((f) => (
            <div className="file-row" key={f.path}>
              <FileText size={14} />
              {f.name}
              <button
                type="button"
                className="icon-button"
                aria-label={`Remove retained ${f.name}`}
                onClick={() => setRemovedFiles((old) => [...old, f.path])}
              >
                <X size={14} />
              </button>
            </div>
          ))}
          {files.map((f, i) => (
            <div className="file-row" key={i}>
              <FileText size={14} />
              {f.name}
              <button
                type="button"
                className="icon-button"
                aria-label={`Remove ${f.name}`}
                onClick={() => setFiles((old) => old.filter((_, j) => j !== i))}
              >
                <X size={14} />
              </button>
            </div>
          ))}
          <p className="draft-note">
            Your text and link are saved on this device. Reselect files after leaving.
          </p>
          <button className="button primary full" disabled={busy || uploading}>
            {uploading ? 'Uploading evidence…' : 'Submit for review'}
            <ArrowRight size={16} />
          </button>
        </form>
      )}
      {owner && task.status === 'submitted' && (
        <div className="review-form">
          <h4>Review the work</h4>
          <label>
            Feedback
            <textarea
              rows={3}
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              placeholder="Add helpful feedback. Required for a revision or rejection."
              maxLength={2000}
            />
          </label>
          <div className="review-actions">
            <button
              className="button primary"
              disabled={busy}
              onClick={() => act('approve', { feedback })}
            >
              <CheckCheck size={16} />
              Approve work
            </button>
            <button
              className="button secondary"
              disabled={busy}
              onClick={() => {
                if (feedback.trim().length < 10) {
                  setError('Explain what needs changing in at least 10 characters.');
                  return;
                }
                act('revise', { feedback });
              }}
            >
              Request revision
            </button>
          </div>
          <button
            className="text-button danger-text"
            disabled={busy}
            onClick={() => {
              if (feedback.trim().length < 10) {
                setError('Give a reason for rejection in at least 10 characters.');
                return;
              }
              act('reject', { feedback });
            }}
          >
            Reject with reason
          </button>
        </div>
      )}
      {task.status === 'approved' && (
        <div className="payout-box">
          <Wallet size={24} />
          <h4>Good work deserves its reward.</h4>
          <p>
            {owner
              ? 'You approved this submission. Send the agreed NIM reward to finish the bounty.'
              : task.payment?.hash
                ? 'Payment submitted. Waiting for on-chain confirmation.'
                : 'Your work is approved. The creator’s payment is still outstanding.'}
          </p>
          {worker && task.payment?.hash && (
            <button
              className="button secondary full"
              disabled={busy}
              onClick={() => act('verify-payment')}
            >
              Check payment
              <ShieldCheck size={17} />
            </button>
          )}
          {owner && (
            <>
              <div className="payout-details">
                <span>Recipient</span>
                <strong>{preview ? 'Preview worker' : short(task.worker || '')}</strong>
                <span>Reward</span>
                <strong>{nim(task.rewardLuna)} NIM</strong>
              </div>
              {!confirmPay ? (
                <button
                  className="button primary full"
                  disabled={busy}
                  onClick={() => setConfirmPay(true)}
                >
                  {task.payment?.hash
                    ? 'Check payment'
                    : preview
                      ? 'Preview a payout'
                      : 'Review payout'}
                  <ArrowRight size={17} />
                </button>
              ) : (
                <>
                  <p className="payout-confirm">
                    {preview
                      ? 'This creates a sample receipt. No NIM will be sent.'
                      : 'The Nimiq Pay confirmation will show the exact reward, recipient, and network.'}
                  </p>
                  <button
                    className="button primary full"
                    disabled={busy}
                    onClick={() => act(task.payment?.hash ? 'verify-payment' : 'pay')}
                  >
                    {busy
                      ? 'Checking payment…'
                      : task.payment?.hash
                        ? 'Verify transaction'
                        : preview
                          ? 'Simulate payout'
                          : 'Open Nimiq Pay'}
                    <Wallet size={17} />
                  </button>
                </>
              )}
              {task.payment?.state === 'uncertain' && (
                <p className="inline-error">
                  Payment outcome unknown. Check your wallet and enter its transaction hash below.
                  Do not send another payment.
                </p>
              )}
              {task.payment?.state === 'uncertain' && (
                <form
                  className="recover-form"
                  onSubmit={(e) => {
                    e.preventDefault();
                    const hash = new FormData(e.currentTarget).get('hash');
                    act('recover-payment', { hash });
                  }}
                >
                  <input
                    name="hash"
                    aria-label="Transaction hash"
                    placeholder="64-character transaction hash"
                    value={recoveryHash}
                    onChange={(e) => setRecoveryHash(e.target.value)}
                    pattern="[a-fA-F0-9]{64}"
                    required
                  />
                  <button className="button secondary" disabled={busy}>
                    Recover
                  </button>
                </form>
              )}
            </>
          )}
        </div>
      )}
      {task.status === 'paid' && (
        <div className="receipt">
          <span className="receipt-check">
            <ShieldCheck size={30} />
          </span>
          <span className="eyebrow">{preview ? 'PREVIEW RECEIPT' : 'VERIFIED PAYMENT'}</span>
          <h3>
            {nim(task.rewardLuna)} <span>NIM</span>
          </h3>
          <p>
            {preview
              ? 'A sample reward for a job well done. No real NIM was transferred.'
              : 'Payment independently confirmed on Nimiq.'}
          </p>
          {task.payment?.hash && (
            <a
              className="button secondary"
              target="_blank"
              rel="noreferrer"
              href={`https://${task.payment.network === 'testnet' ? 'test.' : ''}nimiqwatch.com/#${task.payment.hash}`}
            >
              View transaction
              <ExternalLink size={14} />
            </a>
          )}
        </div>
      )}
      <div className="trust-notice">
        <Info size={16} />
        <p>
          {preview && <strong>Preview bounty. </strong>}Rewards are offered by the creator and paid
          directly after approval. Funds are not locked or guaranteed.
        </p>
      </div>
      {worker && ['approved', 'rejected'].includes(task.status) && (
        <details className="report-problem">
          <summary>Report a problem with this bounty</summary>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              act('report', { feedback: reportReason });
            }}
          >
            <label>
              What happened?
              <textarea
                value={reportReason}
                onChange={(e) => setReportReason(e.target.value)}
                minLength={10}
                maxLength={2000}
                required
                placeholder="Describe the issue or non-payment."
              />
            </label>
            <button className="button secondary" disabled={busy}>
              {preview ? 'Preview a report' : 'Record report'}
            </button>
          </form>
        </details>
      )}
      {error && (
        <p className="inline-error" role="alert">
          {error}
        </p>
      )}
      {task.status === 'open' && !owner && (
        <button
          className="button primary full"
          disabled={busy || new Date(task.deadline).getTime() <= Date.now()}
          onClick={() => (address ? act('claim') : onConnect())}
        >
          {busy ? 'Claiming…' : address ? 'Claim this bounty' : 'Connect to claim'}
          <ArrowRight size={18} />
        </button>
      )}
      {owner && task.status === 'open' && (
        <button className="button secondary full" disabled={busy} onClick={() => act('cancel')}>
          Cancel bounty
        </button>
      )}
      {worker && task.status === 'claimed' && !task.evidence && (
        <button className="text-button" disabled={busy} onClick={() => act('release')}>
          Release bounty
        </button>
      )}
    </div>
  );
}
