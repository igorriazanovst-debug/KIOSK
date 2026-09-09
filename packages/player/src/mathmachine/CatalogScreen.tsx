import React, { useState } from 'react';
import type { MathMachineContent, GroupProgress } from '@kiosk/shared';
import { listTopics, listGroupsForTopic, tasksForGroup, nextUndoneTaskId, summarizeGroupProgress } from '@kiosk/shared';
import TaskRunner from './TaskRunner';

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
    <div style={{ padding: 24 }}>
      <h2>Матемашка — выбери тему</h2>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        {topics.map((t) => (
          <button key={t.topicId} onClick={() => setOpenTopicId(t.topicId)} style={topicButtonStyle}>
            {t.topicName}
          </button>
        ))}
      </div>

      {openTopicId && (
        <div style={{ marginTop: 24 }}>
          <h3>{content.topics[openTopicId]?.name}</h3>
          {listGroupsForTopic(content, openTopicId).map((group) => {
            const summary = summarizeGroupProgress(group, progress[group.id]);
            return (
              <div key={group.id} style={groupRowStyle}>
                <span>{group.name}</span>
                <span>{summary.doneCount}/{summary.total}</span>
                <button onClick={() => setActiveGroupId(group.id)}>Начать</button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

const topicButtonStyle: React.CSSProperties = { padding: '12px 20px', borderRadius: 10, border: '2px solid #8e44ad', background: '#f3e5f5', cursor: 'pointer', fontSize: 16 };
const groupRowStyle: React.CSSProperties = { display: 'flex', gap: 16, alignItems: 'center', padding: '8px 0' };

export default CatalogScreen;
