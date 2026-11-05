import {
  ArrowUpRight,
  Clock3,
  Code2,
  Feather,
  Globe2,
  Palette,
  Search,
  Sparkles,
} from 'lucide-react';
import { motion, useReducedMotion } from 'framer-motion';
import { nim, statusLabels, type Category, type Task } from '../lib/types';
export const categoryIcons = {
  Design: Palette,
  Development: Code2,
  Writing: Feather,
  Research: Search,
  Community: Globe2,
};
export function CategoryIcon({ category, size = 21 }: { category: Category; size?: number }) {
  const Icon = categoryIcons[category];
  return <Icon size={size} strokeWidth={1.65} />;
}
export function daysLeft(deadline: string) {
  const d = Math.ceil((new Date(deadline).getTime() - Date.now()) / 86400_000);
  return d <= 0 ? 'Deadline passed' : d === 1 ? '1 day left' : `${d} days left`;
}
export function TaskCard({
  task,
  index = 0,
  onOpen,
  readOnly = false,
}: {
  task: Task;
  index?: number;
  onOpen?: () => void;
  readOnly?: boolean;
}) {
  const reduced = useReducedMotion();
  const Card = readOnly ? motion.div : motion.button;
  return (
    <Card
      className={`task-card ${task.category.toLowerCase()}`}
      onClick={readOnly ? undefined : onOpen}
      initial={reduced ? false : { opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28, delay: Math.min(index * 0.035, 0.21) }}
      whileHover={reduced || readOnly ? undefined : { y: -4 }}
      whileTap={reduced || readOnly ? undefined : { scale: 0.99 }}
    >
      <div className="card-top">
        <span className="category-icon">
          <CategoryIcon category={task.category} />
        </span>
        <span className={`category-pill ${task.featured ? 'featured' : ''}`}>
          {task.featured ? (
            <>
              <Sparkles size={11} /> Featured
            </>
          ) : (
            task.category
          )}
        </span>
        <ArrowUpRight className="card-arrow" size={17} />
      </div>
      <h3>{task.title}</h3>
      <p className="card-description">{task.description}</p>
      <div className="card-reward">
        <span className="nim-mark" />
        <strong>{nim(task.rewardLuna)}</strong>
        <span>NIM</span>
        <span className="card-duration">
          <Clock3 size={12} />
          {task.minutes} min
        </span>
      </div>
      <div className="card-footer">
        <span className="avatar">{task.avatar}</span>
        <span className="creator-name">{task.creatorName}</span>
        <span className={`deadline ${task.status !== 'open' ? 'status-' + task.status : ''}`}>
          {task.status === 'open' ? daysLeft(task.deadline) : statusLabels[task.status]}
        </span>
      </div>
    </Card>
  );
}
