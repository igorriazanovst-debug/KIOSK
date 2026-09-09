import React, { useState } from 'react';
import type { MathMachineContent, GroupProgress } from '@kiosk/shared';
import { listTopics, listGroupsForTopic, tasksForGroup, nextUndoneTaskId, summarizeGroupProgress } from '@kiosk/shared';
import TaskRunner from './TaskRunner';
import Mascot from './Mascot';
import { COLOR, FONT, RADIUS, SHADOW } from './theme';

interface Props {
  content: MathMachineContent;
  progress: Record<string, GroupProgress>;
  soundOn: boolean;
  onProgressChange: (groupId: string, progress: GroupProgress) => void;
}

const CatalogScreen: React.FC<Props> = ({ content, progress, soundOn, onProgressChange }) => {
  const [openTopicId, setOpenTopicId] = useState<string | null>(null);
  const [activeGroupId, setActiveGroupId] = useState<string | null>(null);

  if (activeGroupId) {
    const group = content.groups[activeGroupId];
    const tasks = tasksForGroup(content, activeGroupId);
    const groupProgress = progress[activeGroupId];
    const currentTaskId = nextUndoneTaskId(group, groupProgress) ?? tasks[tasks.length - 1]?.id;
    const currentTask = tasks.find((t) => t.id === currentTaskId);
    if (!currentTask) return null;

    return (
      <TaskRunner
        key={currentTask.id}
        task={currentTask}
        soundOn={soundOn}
        onClose={() => setActiveGroupId(null)}
        onCorrect={() => {
          const doneTaskIds = Array.from(new Set([...(groupProgress?.doneTaskIds ?? []), currentTask.id]));
          const next = nextUndoneTaskId(group, { doneTaskIds, currentTaskId: null });
          onProgressChange(activeGroupId, { doneTaskIds, currentTaskId: next });
          if (!next) setActiveGroupId(null);
        }}
      />
    );
  }

  const topics = listTopics(content);

  return (
    <div style={{ padding: '24px 32px 48px', fontFamily: FONT.ui, color: COLOR.text }}>
      <div style={greetingRowStyle}>
        <Mascot pose="greeting" size={88} />
        <div>
          <h2 style={headingStyle}>Выбери тему</h2>
          <div style={{ color: COLOR.textMuted, fontSize: 15 }}>Матвей поможет — просто нажми на карточку</div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginTop: 20 }}>
        {topics.map((t) => (
          <button key={t.topicId} onClick={() => setOpenTopicId(t.topicId)} style={topicCardStyle(t.topicId === openTopicId)}>
            {t.topicName}
          </button>
        ))}
      </div>

      {openTopicId && (
        <div style={{ marginTop: 28 }}>
          <h3 style={subHeadingStyle}>{content.topics[openTopicId]?.name}</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 12 }}>
            {listGroupsForTopic(content, openTopicId).map((group) => {
              const summary = summarizeGroupProgress(group, progress[group.id]);
              const isDone = summary.doneCount === summary.total && summary.total > 0;
              return (
                <div key={group.id} style={groupRowStyle}>
                  <span style={{ fontWeight: 700, flex: 1 }}>{group.name}</span>
                  <span style={progressPillStyle(isDone)}>{summary.doneCount}/{summary.total}</span>
                  <button onClick={() => setActiveGroupId(group.id)} style={startButtonStyle}>Начать</button>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

const greetingRowStyle: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 18 };
const headingStyle: React.CSSProperties = { fontFamily: FONT.display, fontSize: 28, color: COLOR.indigo, margin: 0 };
const subHeadingStyle: React.CSSProperties = { fontSize: 20, fontWeight: 700, color: COLOR.indigoDark, margin: 0 };

function topicCardStyle(active: boolean): React.CSSProperties {
  return {
    padding: '14px 22px',
    borderRadius: RADIUS.md,
    border: active ? `2px solid ${COLOR.amber}` : `2px solid ${COLOR.border}`,
    background: active ? COLOR.amberLight : COLOR.surface,
    color: COLOR.text,
    cursor: 'pointer',
    fontFamily: FONT.ui,
    fontSize: 16,
    fontWeight: 700,
    boxShadow: active ? SHADOW.card : SHADOW.soft,
  };
}

const groupRowStyle: React.CSSProperties = {
  display: 'flex',
  gap: 16,
  alignItems: 'center',
  padding: '14px 18px',
  background: COLOR.surface,
  borderRadius: RADIUS.md,
  border: `1px solid ${COLOR.border}`,
  boxShadow: SHADOW.soft,
};

function progressPillStyle(done: boolean): React.CSSProperties {
  return {
    padding: '4px 12px',
    borderRadius: 999,
    fontSize: 13,
    fontWeight: 700,
    background: done ? COLOR.mintLight : COLOR.indigoLight,
    color: done ? COLOR.mintDark : COLOR.indigoDark,
  };
}

const startButtonStyle: React.CSSProperties = {
  padding: '9px 20px',
  borderRadius: RADIUS.sm,
  border: 'none',
  background: COLOR.indigo,
  color: '#fff',
  fontFamily: FONT.ui,
  fontWeight: 700,
  fontSize: 14,
  cursor: 'pointer',
};

export default CatalogScreen;
