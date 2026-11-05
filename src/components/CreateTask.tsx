import { useState } from 'react';
import { ArrowRight, Eye, Info, Plus, X } from 'lucide-react';
import { categories, nim, toLuna, type Category, type Task } from '../lib/types';
import { TaskCard } from './TaskCard';
export interface CreateInput {
  title: string;
  description: string;
  category: Category;
  rewardLuna: number;
  minutes: number;
  deadline: string;
  requirements: string[];
}
export function CreateTask({
  onCreate,
  busy,
  connected,
  onConnect,
}: {
  onCreate: (body: CreateInput) => Promise<void>;
  busy: boolean;
  connected: boolean;
  onConnect: () => void;
}) {
  const [title, setTitle] = useState(''),
    [description, setDescription] = useState(''),
    [category, setCategory] = useState<Category>('Design'),
    [reward, setReward] = useState('250'),
    [minutes, setMinutes] = useState('30'),
    [deadline, setDeadline] = useState(
      new Date(Date.now() + 7 * 86400_000).toISOString().slice(0, 10),
    ),
    [requirements, setRequirements] = useState(['']),
    [error, setError] = useState('');
  const [preview, setPreview] = useState(false);
  let rewardLuna = 0;
  try {
    rewardLuna = toLuna(reward);
  } catch {
    /* field validated on submit */
  }
  const parsedDeadline = new Date(deadline + 'T23:59:59');
  const validDeadline = !Number.isNaN(parsedDeadline.getTime());
  const deadlineIso = validDeadline
    ? parsedDeadline.toISOString()
    : new Date(Date.now() + 7 * 86400_000).toISOString();
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    try {
      if (!connected) {
        onConnect();
        return;
      }
      if (title.trim().length < 8)
        throw new Error('Give your bounty a descriptive title of at least 8 characters.');
      if (description.trim().length < 30)
        throw new Error('Add at least 30 characters describing the work.');
      const req = requirements.map((x) => x.trim()).filter(Boolean);
      if (!req.length || req.some((r) => r.length < 3))
        throw new Error('Add at least one clear acceptance requirement.');
      if (!validDeadline || parsedDeadline.getTime() <= Date.now())
        throw new Error('Choose a future deadline.');
      await onCreate({
        title: title.trim(),
        description: description.trim(),
        category,
        rewardLuna: toLuna(reward),
        minutes: Number(minutes),
        deadline: deadlineIso,
        requirements: req,
      });
    } catch (err) {
      setError((err as Error).message);
    }
  }
  const task: Task = {
    id: 'draft',
    title: title || 'Your next great bounty',
    description: description || 'Describe the work and give someone a reason to get involved.',
    category,
    rewardLuna,
    minutes: Number(minutes),
    deadline: deadlineIso,
    creator: '',
    creatorName: 'You',
    avatar: 'YO',
    status: 'open',
    worker: null,
    requirements,
    createdAt: new Date().toISOString(),
  };
  return (
    <div className="create-layout">
      <form className="form-panel" onSubmit={submit}>
        <div className="panel-heading">
          <span className="category-icon">
            <Plus size={22} />
          </span>
          <div>
            <h2>Turn your to-do into a bounty.</h2>
            <p>Clear instructions make great work possible.</p>
          </div>
        </div>
        <label>
          Bounty title
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Test our new Mini App"
            maxLength={100}
            required
          />
        </label>
        <label>
          What needs doing?
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Describe the task, share useful links, and explain what success looks like."
            rows={5}
            minLength={30}
            maxLength={5000}
            required
          />
        </label>
        <div className="form-row">
          <label>
            Category
            <select value={category} onChange={(e) => setCategory(e.target.value as Category)}>
              {categories.slice(1).map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </label>
          <label>
            Reward in NIM
            <div className="input-suffix">
              <input
                type="text"
                inputMode="decimal"
                value={reward}
                onChange={(e) => setReward(e.target.value)}
                required
              />
              <span>NIM</span>
            </div>
          </label>
        </div>
        <div className="form-row">
          <label>
            Estimated time (minutes)
            <input
              type="number"
              min="5"
              max="1440"
              value={minutes}
              onChange={(e) => setMinutes(e.target.value)}
              required
            />
          </label>
          <label>
            Submission deadline
            <input
              type="date"
              value={deadline}
              min={new Date(Date.now() + 86400_000).toISOString().slice(0, 10)}
              onChange={(e) => setDeadline(e.target.value)}
              required
            />
          </label>
        </div>
        <div className="field-label">
          Acceptance requirements <span>Be specific about the proof you need.</span>
        </div>
        {requirements.map((r, i) => (
          <div className="requirement-input" key={i}>
            <span>{String(i + 1).padStart(2, '0')}</span>
            <input
              aria-label={`Requirement ${i + 1}`}
              value={r}
              onChange={(e) =>
                setRequirements((old) => old.map((x, j) => (j === i ? e.target.value : x)))
              }
              placeholder="e.g. 3 bug reports with screenshots"
              maxLength={500}
            />
            {requirements.length > 1 && (
              <button
                type="button"
                className="icon-button"
                aria-label={`Remove requirement ${i + 1}`}
                onClick={() => setRequirements((old) => old.filter((_, j) => j !== i))}
              >
                <X size={16} />
              </button>
            )}
          </div>
        ))}
        {requirements.length < 8 && (
          <button
            type="button"
            className="text-button"
            onClick={() => setRequirements((old) => [...old, ''])}
          >
            <Plus size={14} /> Add requirement
          </button>
        )}
        <div className="trust-notice">
          <Info size={17} />
          <p>
            You’re offering <strong>{nim(rewardLuna)} NIM</strong> to one worker. Pay directly after
            approving their work. The reward is <strong>not escrowed</strong>.
          </p>
        </div>
        {error && (
          <p className="inline-error" role="alert">
            {error}
          </p>
        )}
        <div className="form-actions">
          <button
            type="button"
            className="button secondary preview-toggle"
            onClick={() => setPreview(!preview)}
          >
            <Eye size={16} />
            Preview
          </button>
          <button className="button primary" disabled={busy}>
            {busy ? 'Publishing…' : connected ? 'Publish bounty' : 'Connect to publish'}
            <ArrowRight size={17} />
          </button>
        </div>
      </form>
      <aside className={`create-preview ${preview ? 'show-preview' : ''}`}>
        <div className="eyebrow">
          <Eye size={14} /> LIVE PREVIEW
        </div>
        <TaskCard task={task} readOnly />
        <div className="creation-tips">
          <h3>A good bounty is a clear bounty.</h3>
          <p>
            Keep the task small. Explain what you need, set a fair reward, and tell workers exactly
            what to submit.
          </p>
          <div>
            <span>01</span> One task. One worker.
          </div>
          <div>
            <span>02</span> Useful work. Fair rewards.
          </div>
          <div>
            <span>03</span> Approve it. Pay with NIM.
          </div>
        </div>
      </aside>
    </div>
  );
}
