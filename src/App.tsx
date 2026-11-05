import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  Check,
  ChevronDown,
  CircleHelp,
  Compass,
  Gift,
  Layers3,
  Menu,
  Plus,
  Search,
  ShieldCheck,
  Sparkles,
  Wallet,
  X,
} from 'lucide-react';
import { Hero } from './components/Hero';
import { TaskCard } from './components/TaskCard';
import { Modal } from './components/Modal';
import { CreateTask, type CreateInput } from './components/CreateTask';
import { TaskDetail } from './components/TaskDetail';
import {
  api,
  connectWallet,
  getWalletAccounts,
  NimiqProviderError,
  prepareReward,
  request,
  sendReward,
} from './lib/api';
import { previewCreator, previewWorker, seedTasks } from './lib/seed';
import {
  categories,
  nim,
  short,
  type Payment,
  type Profile,
  type Task,
  type View,
} from './lib/types';

const navItems: [View, string, typeof Compass][] = [
  ['explore', 'Explore bounties', Compass],
  ['work', 'My work', Layers3],
  ['create', 'Post a bounty', Plus],
  ['rewards', 'My rewards', Gift],
];
function Logo() {
  return (
    <>
      <span className="brand-mark">
        b<span>↗</span>
      </span>
      <span className="wordmark">
        bountex<span>®</span>
      </span>
    </>
  );
}
function initialView(): View {
  const v = location.hash.slice(1).split('/')[0];
  return ['work', 'create', 'rewards'].includes(v) ? (v as View) : 'explore';
}
const previewKey = 'bountex-preview-v1';
export default function App() {
  const [view, setView] = useState<View>(initialView),
    [tasks, setTasks] = useState<Task[]>([]),
    [preview, setPreview] = useState(true),
    [configured, setConfigured] = useState(false),
    [loading, setLoading] = useState(true),
    [network, setNetwork] = useState<'mainnet' | 'testnet'>('testnet'),
    [paymentsReady, setPaymentsReady] = useState(false);
  const [profile, setProfile] = useState<Profile | null>(null),
    [category, setCategory] = useState<string>('All bounties'),
    [search, setSearch] = useState(''),
    [sort, setSort] = useState('newest'),
    [workTab, setWorkTab] = useState('working'),
    [selected, setSelected] = useState<string | null>(null),
    [connectOpen, setConnectOpen] = useState(false),
    [helpOpen, setHelpOpen] = useState(false),
    [mobileOpen, setMobileOpen] = useState(false),
    [busy, setBusy] = useState(false),
    [toast, setToast] = useState<{ message: string; error?: boolean } | null>(null);
  const reduced = useReducedMotion(),
    feed = useRef<HTMLElement>(null),
    timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const notify = useCallback((message: string, error = false) => {
    setToast({ message, error });
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setToast(null), 6500);
  }, []);
  const navigate = useCallback((v: View) => {
    setView(v);
    location.hash = v;
    setMobileOpen(false);
    setSearch('');
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, []);
  useEffect(() => {
    const handle = () => setView(initialView());
    window.addEventListener('hashchange', handle);
    return () => {
      window.removeEventListener('hashchange', handle);
      clearTimeout(timer.current);
    };
  }, []);
  const loadPreview = useCallback(() => {
    let saved: Task[] | null = null;
    try {
      const parsed = JSON.parse(localStorage.getItem(previewKey) || 'null');
      if (Array.isArray(parsed)) saved = parsed;
    } catch {}
    setTasks(saved || seedTasks());
    setPreview(true);
    setProfile(null);
  }, []);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const conf = await api.config();
        if (cancelled) return;
        setConfigured(conf.configured);
        setNetwork(conf.network);
        setPaymentsReady(conf.paymentsReady);
        if (conf.configured) {
          setTasks(await api.tasks());
          setPreview(false);
          try {
            setProfile(await api.me());
          } catch {}
        } else loadPreview();
      } catch {
        if (!cancelled) {
          loadPreview();
          notify('Live service unavailable. Showing the labeled preview.', true);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [loadPreview, notify]);
  useEffect(() => {
    if (preview && tasks.length) localStorage.setItem(previewKey, JSON.stringify(tasks));
  }, [tasks, preview]);
  const openTasks = useMemo(
    () => tasks.filter((t) => t.status === 'open' && new Date(t.deadline).getTime() > Date.now()),
    [tasks],
  );
  const filtered = useMemo(
    () =>
      openTasks
        .filter(
          (t) =>
            (category === 'All bounties' || t.category === category) &&
            (t.title + ' ' + t.description + ' ' + t.creatorName)
              .toLowerCase()
              .includes(search.toLowerCase()),
        )
        .sort((a, b) =>
          sort === 'reward'
            ? b.rewardLuna - a.rewardLuna
            : sort === 'quickest'
              ? a.minutes - b.minutes
              : new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
        ),
    [openTasks, category, search, sort],
  );
  const myWorking = tasks.filter((t) => t.worker === profile?.address),
    myCreated = tasks.filter((t) => t.creator === profile?.address),
    paid = myWorking.filter((t) => t.status === 'paid'),
    pending = myWorking.filter((t) => t.status === 'approved'),
    currentTask = tasks.find((t) => t.id === selected);
  const update = (task: Task) =>
    setTasks((old) =>
      old.some((t) => t.id === task.id)
        ? old.map((t) => (t.id === task.id ? task : t))
        : [task, ...old],
    );
  const enterPreview = (role: 'worker' | 'creator') => {
    setWorkTab(role === 'worker' ? 'working' : 'created');
    if (!preview) {
      loadPreview();
    }
    setProfile({
      address: role === 'worker' ? previewWorker : previewCreator,
      name: role === 'worker' ? 'Alex Morgan' : 'Task creator',
      accounts: [],
    });
    setConnectOpen(false);
    notify(`Preview ${role} account selected. No real wallet connected.`);
  };
  async function connect() {
    setBusy(true);
    try {
      const conf = await api.config();
      if (!conf.configured)
        throw new Error(
          'Live bounties aren’t available yet. Choose a preview role to explore Bountex.',
        );
      const p = await connectWallet();
      setProfile(p);
      setPreview(false);
      setTasks(await api.tasks());
      setConnectOpen(false);
      notify('Your Nimiq wallet is connected.');
    } catch (e) {
      notify(
        (e as Error).message.includes('timeout')
          ? 'Open Bountex inside Nimiq Pay to connect your wallet.'
          : (e as Error).message,
        true,
      );
    } finally {
      setBusy(false);
    }
  }
  async function changeMode() {
    if (!preview) {
      await api.logout();
      loadPreview();
      notify('Preview mode. Sample bounties only.');
      return;
    }
    if (!configured) {
      setConnectOpen(true);
      return;
    }
    setBusy(true);
    try {
      setTasks(await api.tasks());
      setPreview(false);
      setProfile(null);
    } catch (e) {
      notify((e as Error).message, true);
    } finally {
      setBusy(false);
    }
  }
  async function create(body: CreateInput) {
    setBusy(true);
    try {
      if (!profile) throw new Error('Connect an account to post a bounty.');
      if (preview) {
        update({
          ...body,
          id: `preview-${crypto.randomUUID()}`,
          creator: profile.address,
          creatorName: profile.name,
          avatar: profile.name
            .split(' ')
            .map((x) => x[0])
            .join('')
            .slice(0, 2),
          status: 'open',
          worker: null,
          createdAt: new Date().toISOString(),
        });
      } else update(await api.create(body));
      setWorkTab('created');
      navigate('work');
      notify(
        preview ? 'Preview bounty published on this device.' : 'Your bounty is open for work.',
      );
    } finally {
      setBusy(false);
    }
  }
  async function action(action: string, body: Record<string, unknown> = {}) {
    if (!currentTask || !profile) return;
    setBusy(true);
    try {
      if (preview) {
        const t = { ...currentTask };
        if (action === 'claim') {
          if (t.creator === profile.address)
            throw new Error('Switch to the preview worker account to claim this task.');
          if (t.status !== 'open') throw new Error('This bounty is already claimed.');
          t.worker = profile.address;
          t.status = 'claimed';
        }
        if (action === 'release') {
          t.worker = null;
          t.status = 'open';
        }
        if (action === 'submit') {
          t.evidence = body.evidence as Task['evidence'];
          t.status = 'submitted';
        }
        if (['approve', 'revise', 'reject'].includes(action)) {
          t.status =
            action === 'approve' ? 'approved' : action === 'revise' ? 'revision' : 'rejected';
          t.feedback = String(body.feedback || '');
          if (action === 'revise')
            t.deadline = new Date(
              Math.max(new Date(t.deadline).getTime(), Date.now() + 48 * 3600_000),
            ).toISOString();
        }
        if (action === 'cancel') t.status = 'cancelled';
        if (action === 'pay') {
          t.status = 'paid';
          t.payment = {
            hash: null,
            state: 'confirmed',
            recipient: t.worker!,
            sender: t.creator,
            reference: `PREVIEW:${t.id}`,
            network: 'testnet',
          };
        }
        update(t);
      } else if (action === 'pay') {
        if (!paymentsReady)
          throw new Error('Payout verification is not configured yet. The reward remains unpaid.');
        const accounts = await getWalletAccounts();
        const intent = await request<Payment>(`tasks/${currentTask.id}/payment-intent`, {
          accounts,
        });
        update({ ...currentTask, payment: intent });
        if (intent.state === 'uncertain')
          throw new Error(
            'An earlier payout needs recovery. Check the transaction in Nimiq Pay before retrying.',
          );
        if (intent.hash) {
          update(await api.action(currentTask.id, 'verify-payment'));
          notify('Payment status refreshed.');
          return;
        }
        const storageKey = `bountex-payment:${currentTask.id}`;
        await prepareReward(intent);
        await request<{ ok: boolean }>(`tasks/${currentTask.id}/start-payment`, {});
        localStorage.setItem(
          storageKey,
          JSON.stringify({ intentId: intent.intentId, state: 'uncertain' }),
        );
        let hash: string;
        try {
          hash = await sendReward(intent, currentTask.rewardLuna);
        } catch (e) {
          if (NimiqProviderError.is(e) && e.type === 'PERMISSION_DENIED') {
            await request<{ ok: boolean }>(`tasks/${currentTask.id}/cancel-payment`, {
              intentId: intent.intentId,
            });
            localStorage.removeItem(storageKey);
            update({ ...currentTask, payment: undefined });
          } else update({ ...currentTask, payment: { ...intent, state: 'uncertain' } });
          throw e;
        }
        localStorage.setItem(storageKey, JSON.stringify({ intentId: intent.intentId, hash }));
        update({ ...currentTask, payment: { ...intent, hash, state: 'pending' } });
        try {
          update(
            await api.action(currentTask.id, 'record-payment', { intentId: intent.intentId, hash }),
          );
        } catch (e) {
          update({ ...currentTask, payment: { ...intent, hash, state: 'uncertain' } });
          throw e;
        }
        try {
          const verified = await api.action(currentTask.id, 'verify-payment');
          update(verified);
          if (verified.status === 'paid') localStorage.removeItem(storageKey);
        } catch (e) {
          notify((e as Error).message, true);
          return;
        }
      } else if (action === 'recover-payment') {
        update(
          await api.action(currentTask.id, 'record-payment', {
            hash: body.hash,
            intentId: currentTask.payment?.intentId,
          }),
        );
        update(await api.action(currentTask.id, 'verify-payment'));
        localStorage.removeItem(`bountex-payment:${currentTask.id}`);
      } else update(await api.action(currentTask.id, action, body));
      notify(
        (
          {
            claim: 'Bounty claimed. Your next good thing starts here.',
            submit: 'Work submitted. The creator can now review it.',
            approve: 'Work approved. The reward is ready to pay.',
            revise: 'Revision requested with your feedback.',
            reject: 'Submission rejected with your reason.',
            pay: preview
              ? 'Preview payout complete. No NIM was transferred.'
              : 'Payment submitted. Check the receipt for confirmation.',
            'verify-payment': 'Payment status refreshed.',
            cancel: 'Bounty cancelled.',
            release: 'Bounty released.',
            report: preview
              ? 'Preview report recorded. No report was sent.'
              : 'Your report has been recorded for the maintainer.',
          } as Record<string, string>
        )[action] || 'Updated.',
      );
    } finally {
      setBusy(false);
    }
  }
  const closeDetail = useCallback(() => setSelected(null), []),
    closeConnect = useCallback(() => setConnectOpen(false), []),
    closeHelp = useCallback(() => setHelpOpen(false), []);
  useEffect(() => {
    if (preview || !configured || loading) return;
    let stopped = false;
    const refresh = async () => {
      if (document.visibilityState !== 'visible') return;
      try {
        const items = await api.tasks();
        if (!stopped) setTasks(items);
      } catch {
        /* Keep the last successful data during a temporary network failure. */
      }
    };
    const interval = setInterval(refresh, 20000);
    window.addEventListener('focus', refresh);
    return () => {
      stopped = true;
      clearInterval(interval);
      window.removeEventListener('focus', refresh);
    };
  }, [preview, configured, loading]);
  useEffect(() => {
    if (
      preview ||
      currentTask?.status !== 'approved' ||
      currentTask?.payment?.state !== 'pending' ||
      (currentTask.creator !== profile?.address && currentTask.worker !== profile?.address)
    )
      return;
    let stopped = false;
    const interval = setInterval(async () => {
      if (busy || document.visibilityState !== 'visible') return;
      try {
        const result = await api.action(currentTask.id, 'verify-payment');
        if (stopped) return;
        update(result);
        if (result.status === 'paid') {
          localStorage.removeItem(`bountex-payment:${result.id}`);
          notify('Payment confirmed. Good work, rewarded.');
        }
      } catch {
        /* Pending receipts remain visible and can be checked manually. */
      }
    }, 8000);
    return () => {
      stopped = true;
      clearInterval(interval);
    };
  }, [
    preview,
    currentTask?.id,
    currentTask?.payment?.state,
    currentTask?.status,
    profile?.address,
    busy,
    notify,
  ]);
  const title =
    view === 'explore'
      ? 'Explore'
      : view === 'work'
        ? 'My work'
        : view === 'create'
          ? 'Post a bounty'
          : 'My rewards';
  return (
    <div className="app-shell">
      {mobileOpen && (
        <button
          className="mobile-backdrop"
          aria-label="Close navigation"
          onClick={() => setMobileOpen(false)}
        />
      )}
      <aside className={`sidebar ${mobileOpen ? 'sidebar-open' : ''}`}>
        <button className="brand" onClick={() => navigate('explore')} aria-label="Bountex home">
          <Logo />
        </button>
        <div className="workspace-label">WORKSPACE</div>
        <nav aria-label="Main navigation">
          {navItems.map(([key, label, Icon]) => (
            <button
              key={key}
              aria-label={label}
              className={`nav-item ${view === key ? 'active' : ''}`}
              onClick={() => navigate(key)}
            >
              <Icon size={19} strokeWidth={1.7} />
              <span>{label}</span>
              {key === 'work' && myWorking.filter((t) => t.status !== 'paid').length > 0 && (
                <small>{myWorking.filter((t) => t.status !== 'paid').length}</small>
              )}
              {view === key && <span className="nav-dot" />}
            </button>
          ))}
        </nav>
        <div className="sidebar-promo">
          <span className="promo-orbit">
            <Sparkles size={22} />
          </span>
          <h3>
            A little work.
            <br />A lot of potential.
          </h3>
          <p>
            Your skills can make
            <br />
            someone’s day.
          </p>
          <button
            onClick={() => {
              navigate('explore');
              feed.current?.scrollIntoView({ behavior: reduced ? 'instant' : 'smooth' });
            }}
          >
            Find your first bounty
            <ArrowUpRight size={14} />
          </button>
        </div>
        <div className="sidebar-bottom">
          <button className="nav-item" onClick={() => setHelpOpen(true)}>
            <CircleHelp size={18} />
            <span>How Bountex works</span>
            <ArrowUpRight size={13} />
          </button>
          <div className="powered">
            <span className="tiny-hex" />
            <span>
              Powered by <strong>Nimiq</strong>
            </span>
            <span className="live-dot" />
          </div>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <div className="topbar-left">
            <button
              className="icon-button menu-button"
              aria-label="Open navigation"
              onClick={() => setMobileOpen(!mobileOpen)}
            >
              <Menu size={21} />
            </button>
            <span className="breadcrumb">Workspace</span>
            <span className="breadcrumb-divider">/</span>
            <strong>{title}</strong>
          </div>
          <div className="topbar-right">
            <span className={`mode-indicator ${preview ? 'preview-mode' : ''}`}>
              <span />
              {preview ? 'Preview mode' : `${network === 'testnet' ? 'Testnet' : 'Mainnet'} · Live`}
            </span>
            <button
              className={`wallet-button ${profile ? 'connected' : ''}`}
              onClick={() => setConnectOpen(true)}
            >
              {profile ? (
                <>
                  <span className="wallet-avatar">{profile.name.slice(0, 1)}</span>
                  <span>
                    {preview
                      ? profile.address === previewCreator
                        ? 'Creator preview'
                        : 'Worker preview'
                      : short(profile.address)}
                  </span>
                  <ChevronDown size={13} />
                </>
              ) : (
                <>
                  <Wallet size={16} />
                  <span>Connect wallet</span>
                </>
              )}
            </button>
          </div>
        </header>
        <main>
          <AnimatePresence mode="wait">
            <motion.div
              key={view}
              initial={reduced ? false : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18 }}
            >
              {view === 'explore' ? (
                <>
                  <div className="page-heading">
                    <div>
                      <div className="eyebrow page-eyebrow">A LITTLE SKILL GOES A LONG WAY</div>
                      <h2>
                        Find your next good thing<span>.</span>
                      </h2>
                      <p>Small tasks. Useful work. Rewards that are worth it.</p>
                    </div>
                    <button
                      className="button secondary heading-post"
                      onClick={() => navigate('create')}
                    >
                      <Plus size={16} />
                      Post a bounty
                    </button>
                  </div>
                  <Hero
                    browse={() =>
                      feed.current?.scrollIntoView({
                        behavior: reduced ? 'instant' : 'smooth',
                        block: 'start',
                      })
                    }
                    create={() => navigate('create')}
                  />
                  <div className="stats-row">
                    <div>
                      <span className="stat-icon blue">
                        <Compass size={18} />
                      </span>
                      <span>
                        <strong>{loading ? '—' : openTasks.length}</strong>
                        <small>Open bounties</small>
                      </span>
                      <span className="stat-note">
                        <span />
                        Ready for you
                      </span>
                    </div>
                    <div>
                      <span className="stat-icon lime">
                        <Wallet size={18} />
                      </span>
                      <span>
                        <strong>
                          {loading
                            ? '—'
                            : compactNim(openTasks.reduce((sum, t) => sum + t.rewardLuna, 0))}
                          <em>NIM</em>
                        </strong>
                        <small>Rewards on offer</small>
                      </span>
                      <span className="stat-note">
                        {preview ? 'Sample rewards' : 'Direct creator payouts'}
                      </span>
                    </div>
                    <div>
                      <span className="stat-icon aqua">
                        <Layers3 size={18} />
                      </span>
                      <span>
                        <strong>5</strong>
                        <small>Ways to contribute</small>
                      </span>
                      <span className="stat-note">Find your fit</span>
                    </div>
                  </div>
                  <section className="feed" ref={feed} aria-labelledby="feed-title">
                    <div className="feed-heading">
                      <div>
                        <h2 id="feed-title">
                          The bounty board <span>{filtered.length}</span>
                        </h2>
                        <p>Your next opportunity is closer than you think.</p>
                      </div>
                      <label className="search-field">
                        <Search size={16} />
                        <input
                          aria-label="Search bounties"
                          placeholder="Search bounties…"
                          value={search}
                          onChange={(e) => setSearch(e.target.value)}
                        />
                        {search && (
                          <button
                            className="icon-button"
                            aria-label="Clear search"
                            onClick={() => setSearch('')}
                          >
                            <X size={14} />
                          </button>
                        )}
                      </label>
                    </div>
                    <div className="filters">
                      <div className="category-tabs" role="tablist" aria-label="Bounty categories">
                        {categories.map((c) => (
                          <button
                            role="tab"
                            aria-selected={category === c}
                            key={c}
                            className={category === c ? 'selected' : ''}
                            onClick={() => setCategory(c)}
                          >
                            {c === 'All bounties' && <Compass size={13} />}
                            <span>{c}</span>
                          </button>
                        ))}
                      </div>
                      <label className="sort-field">
                        <ArrowDown size={13} />
                        <select
                          aria-label="Sort bounties"
                          value={sort}
                          onChange={(e) => setSort(e.target.value)}
                        >
                          <option value="newest">Newest first</option>
                          <option value="reward">Highest reward</option>
                          <option value="quickest">Quickest tasks</option>
                        </select>
                        <ChevronDown size={12} />
                      </label>
                    </div>
                    {loading ? (
                      <div className="task-grid">
                        {[1, 2, 3].map((i) => (
                          <div className="task-card skeleton" key={i}>
                            <span />
                            <span />
                            <span />
                          </div>
                        ))}
                      </div>
                    ) : filtered.length ? (
                      <div className="task-grid">
                        {filtered.map((task, i) => (
                          <TaskCard
                            task={task}
                            key={task.id}
                            index={i}
                            onOpen={() => setSelected(task.id)}
                          />
                        ))}
                      </div>
                    ) : (
                      <Empty
                        icon={Search}
                        title={search ? 'No bounties found.' : 'A little quiet here.'}
                        text={
                          search
                            ? 'Try a different search or explore another category.'
                            : 'Post the first bounty and give someone useful work to do.'
                        }
                        action={() =>
                          search ? (setSearch(''), setCategory('All bounties')) : navigate('create')
                        }
                        button={search ? 'Clear filters' : 'Post a bounty'}
                      />
                    )}
                    <div className="board-footer">
                      <ShieldCheck size={14} />
                      <span>
                        {preview
                          ? 'You’re exploring sample bounties. Switch roles to try the complete workflow.'
                          : 'Rewards are paid directly by creators. Always read the requirements before claiming.'}
                      </span>
                      {preview && (
                        <button onClick={() => setConnectOpen(true)}>
                          Try it out
                          <ArrowRight size={13} />
                        </button>
                      )}
                    </div>
                  </section>
                </>
              ) : (
                <>
                  <div className="page-heading">
                    <div>
                      <div className="eyebrow page-eyebrow">
                        {view === 'create'
                          ? 'GIVE GOOD WORK A PLACE TO START'
                          : view === 'work'
                            ? 'FROM TO-DO TO WELL DONE'
                            : 'EVERY LITTLE BIT OF GOOD WORK'}
                      </div>
                      <h1>
                        {view === 'create'
                          ? 'Put a bounty on it.'
                          : view === 'work'
                            ? 'Good work in progress.'
                            : 'You earned this.'}
                      </h1>
                      <p>
                        {view === 'create'
                          ? 'Find the right person for that thing you need done.'
                          : view === 'work'
                            ? 'Keep track of your tasks, submissions, and next steps.'
                            : 'A clear view of your NIM rewards and payment receipts.'}
                      </p>
                    </div>
                    {view !== 'create' && (
                      <button className="button secondary" onClick={() => navigate('explore')}>
                        <Compass size={16} />
                        Explore bounties
                      </button>
                    )}
                  </div>
                  {view === 'create' ? (
                    <CreateTask
                      onCreate={create}
                      busy={busy}
                      connected={!!profile}
                      onConnect={() => setConnectOpen(true)}
                    />
                  ) : view === 'work' ? (
                    <>
                      <div className="work-tabs">
                        <button
                          className={workTab === 'working' ? 'selected' : ''}
                          onClick={() => setWorkTab('working')}
                        >
                          I’m working on <span>{myWorking.length}</span>
                        </button>
                        <button
                          className={workTab === 'created' ? 'selected' : ''}
                          onClick={() => setWorkTab('created')}
                        >
                          I’ve posted <span>{myCreated.length}</span>
                        </button>
                      </div>
                      {!profile ? (
                        <Empty
                          icon={Wallet}
                          title="Your next chapter starts here."
                          text="Connect your Nimiq wallet, or choose a preview role to try the task workflow."
                          button="Choose account"
                          action={() => setConnectOpen(true)}
                        />
                      ) : (workTab === 'working' ? myWorking : myCreated).length ? (
                        <div className="task-grid">
                          {(workTab === 'working' ? myWorking : myCreated).map((task, i) => (
                            <TaskCard
                              task={task}
                              index={i}
                              key={task.id}
                              onOpen={() => setSelected(task.id)}
                            />
                          ))}
                        </div>
                      ) : (
                        <Empty
                          icon={Layers3}
                          title={
                            workTab === 'working'
                              ? 'Your skills are needed out there.'
                              : 'What’s on your to-do list?'
                          }
                          text={
                            workTab === 'working'
                              ? 'Claim a bounty and it will appear here, from first draft to paid receipt.'
                              : 'Post your first bounty, then review submissions and reward good work.'
                          }
                          button={workTab === 'working' ? 'Find a bounty' : 'Post a bounty'}
                          action={() => navigate(workTab === 'working' ? 'explore' : 'create')}
                        />
                      )}
                    </>
                  ) : (
                    <>
                      <div className="reward-summary">
                        <div>
                          <span className="eyebrow">
                            {preview ? 'PREVIEW EARNINGS' : 'VERIFIED EARNINGS'}
                          </span>
                          <h2>
                            {nim(paid.reduce((s, t) => s + t.rewardLuna, 0))}
                            <span>NIM</span>
                          </h2>
                          <p>
                            From {paid.length} completed {paid.length === 1 ? 'bounty' : 'bounties'}
                          </p>
                          <span className="summary-watermark">b↗</span>
                        </div>
                        <div>
                          <span className="eyebrow">AWAITING PAYMENT</span>
                          <h2>
                            {nim(pending.reduce((s, t) => s + t.rewardLuna, 0))}
                            <span>NIM</span>
                          </h2>
                          <p>
                            {pending.length} approved{' '}
                            {pending.length === 1 ? 'submission' : 'submissions'}
                          </p>
                          <ClockIcon />
                        </div>
                      </div>
                      <div className="feed-heading">
                        <div>
                          <h2>Reward history</h2>
                          <p>Good work, with the receipts to prove it.</p>
                        </div>
                        {preview && <span className="category-pill">Sample receipts</span>}
                      </div>
                      {paid.length ? (
                        <div className="receipt-list">
                          {paid.map((t) => (
                            <button onClick={() => setSelected(t.id)} key={t.id}>
                              <span className="receipt-check">
                                <Check size={20} />
                              </span>
                              <span>
                                <strong>{t.title}</strong>
                                <small>
                                  {preview ? 'Preview payout · No NIM sent' : 'Verified on-chain'}
                                </small>
                              </span>
                              <strong className="receipt-amount">+{nim(t.rewardLuna)} NIM</strong>
                              <ArrowUpRight size={17} />
                            </button>
                          ))}
                        </div>
                      ) : (
                        <Empty
                          icon={Gift}
                          title="Your first reward is waiting."
                          text="Complete a bounty and get paid. Every confirmed receipt will appear here."
                          action={() => navigate('explore')}
                          button="Explore bounties"
                        />
                      )}
                    </>
                  )}
                </>
              )}
              <footer className="site-footer">
                <span>Small tasks. Real possibilities.</span>
                <span>
                  Built on Nimiq
                  <span className="tiny-hex" />
                </span>
              </footer>
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
      <nav className="bottom-nav" aria-label="Mobile navigation">
        {navItems.map(([key, label, Icon]) => (
          <button key={key} className={view === key ? 'active' : ''} onClick={() => navigate(key)}>
            <Icon size={20} />
            <span>
              {key === 'explore'
                ? 'Explore'
                : key === 'work'
                  ? 'My work'
                  : key === 'create'
                    ? 'Post bounty'
                    : 'Rewards'}
            </span>
          </button>
        ))}
      </nav>
      <Modal open={!!currentTask} title="Bounty details" onClose={closeDetail}>
        {currentTask && (
          <TaskDetail
            key={currentTask.id}
            task={currentTask}
            address={profile?.address}
            preview={preview}
            busy={busy}
            onAction={action}
            onConnect={() => {
              setSelected(null);
              setConnectOpen(true);
            }}
          />
        )}
      </Modal>
      <Modal open={connectOpen} title="Your skills. Your rewards." onClose={closeConnect}>
        <div className="connect-content">
          <span className="connect-art">
            <Wallet size={35} />
          </span>
          <h3>Good work starts with you.</h3>
          <p>
            Connect inside Nimiq Pay to claim tasks and receive NIM. Your wallet approves sign-in
            and every payment.
          </p>
          <button className="button primary full" disabled={busy} onClick={connect}>
            {busy ? 'Connecting…' : 'Connect Nimiq Pay'}
            <ArrowUpRight size={17} />
          </button>
          <div className="connect-separator">
            <span />
            or explore the preview
            <span />
          </div>
          <div className="preview-role-options">
            <button onClick={() => enterPreview('worker')}>
              <Compass size={20} />
              <strong>Try as a worker</strong>
              <span>Claim. Create. Submit.</span>
              <ArrowRight size={17} />
            </button>
            <button onClick={() => enterPreview('creator')}>
              <Plus size={20} />
              <strong>Try as a creator</strong>
              <span>Post. Review. Reward.</span>
              <ArrowRight size={17} />
            </button>
          </div>
          <p className="privacy-note">
            <ShieldCheck size={13} /> Preview data stays on this device. No real payments.
          </p>
          {profile && (
            <button
              className="text-button"
              onClick={async () => {
                if (!preview) await api.logout();
                setProfile(null);
                setConnectOpen(false);
                notify('Account disconnected.');
              }}
            >
              Disconnect account
            </button>
          )}
          {configured && (
            <button
              className="text-button"
              disabled={busy}
              onClick={async () => {
                await changeMode();
                setConnectOpen(false);
              }}
            >
              {preview ? 'Browse live bounties' : 'Switch to sample bounties'}
            </button>
          )}
        </div>
      </Modal>
      <Modal open={helpOpen} title="A little work. A real reward." onClose={closeHelp}>
        <div className="help-content">
          {[
            [
              '01',
              'Find your fit',
              'Browse small tasks in design, development, writing, research, and community.',
            ],
            [
              '02',
              'Make something useful',
              'Claim one bounty, complete the requirements, and submit a link or files as proof.',
            ],
            [
              '03',
              'Get your work approved',
              'The creator reviews your submission and can request a revision with feedback.',
            ],
            [
              '04',
              'Receive your NIM',
              'The creator pays directly through Nimiq Pay. Bountex verifies the payment before showing a paid receipt.',
            ],
          ].map(([n, t, p]) => (
            <div key={n}>
              <span>{n}</span>
              <section>
                <h3>{t}</h3>
                <p>{p}</p>
              </section>
            </div>
          ))}
          <div className="trust-notice">
            <ShieldCheck size={17} />
            <p>
              Rewards are not escrowed. Only take work from creators you trust. Report non-payment
              to the project maintainer with the bounty ID.
            </p>
          </div>
          {preview && (
            <button
              className="text-button danger-text"
              onClick={() => {
                localStorage.removeItem(previewKey);
                setTasks(seedTasks());
                setProfile(null);
                setHelpOpen(false);
                notify('Preview reset to the original sample bounties.');
              }}
            >
              Reset sample workspace
            </button>
          )}
        </div>
      </Modal>
      <AnimatePresence>
        {toast && (
          <motion.div
            className={`toast ${toast.error ? 'toast-error' : ''}`}
            style={{ x: '-50%' }}
            role={toast.error ? 'alert' : 'status'}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
          >
            {toast.error ? <CircleHelp size={18} /> : <Check size={18} />}
            <span>{toast.message}</span>
            <button
              className="icon-button"
              aria-label="Dismiss notification"
              onClick={() => setToast(null)}
            >
              <X size={15} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
function Empty({
  icon: Icon,
  title,
  text,
  button,
  action,
}: {
  icon: typeof Search;
  title: string;
  text: string;
  button: string;
  action: () => void;
}) {
  return (
    <div className="empty-state">
      <span className="empty-icon">
        <Icon size={32} strokeWidth={1.4} />
      </span>
      <h3>{title}</h3>
      <p>{text}</p>
      <button className="button primary" onClick={action}>
        {button}
        <ArrowUpRight size={16} />
      </button>
    </div>
  );
}
function compactNim(luna: number) {
  return luna >= 10_000_000_000
    ? new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 }).format(
        luna / 100_000,
      )
    : nim(luna);
}
function ClockIcon() {
  return (
    <div className="summary-watermark">
      <ArrowLeft size={100} />
    </div>
  );
}
