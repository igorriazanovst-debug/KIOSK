// Корневой компонент виджета «ЭУМК»: проверка содержимого, вход по локальной
// учётной записи, меню и разделы. Одинаков для обоих комплексов - различается
// только содержимое `properties.content`.
import React, { useCallback, useMemo, useState } from 'react';
import './eumkTheme.css';
import { EumkContentSchema, type EumkContent, type EumkUserData } from './model/schema.ts';
import { addAccount, loadUserData, markTask, recordResult, removeAccount, resultsFor, saveUserData, signaturesFor } from './userData.ts';
import AccountScreen from './screens/AccountScreen.tsx';
import HomeScreen, { type Section } from './screens/HomeScreen.tsx';
import TheoryScreen from './screens/TheoryScreen.tsx';
import TestScreen from './screens/TestScreen.tsx';
import TasksScreen from './screens/TasksScreen.tsx';
import GamesScreen from './screens/GamesScreen.tsx';
import CasesScreen from './screens/CasesScreen.tsx';
import ReferencesScreen from './screens/ReferencesScreen.tsx';
import ResultsScreen from './screens/ResultsScreen.tsx';
import ErrorBoundary from './components/ErrorBoundary.tsx';

interface Props {
  properties: { title?: string; content?: unknown };
}

const SECTION_TITLES: Record<Section, string> = {
  theory: 'Теория', test: 'Итоговый тест', tasks: 'Практические задания', games: 'Игры', cases: 'Кейсы', references: 'Справочные материалы', results: 'Мои результаты',
};

function browserStorage(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function Shell({ title, user, onBack, onSwitch, children }: { title: string; user: string | null; onBack: (() => void) | null; onSwitch: (() => void) | null; children: React.ReactNode }) {
  return (
    <div className="eumk">
      <header className="eumk-top">
        {onBack && <button type="button" className="eumk-btn" onClick={onBack}>← Меню</button>}
        <h1>{title}</h1>
        {user && <span className="eumk-user">{user}</span>}
        {onSwitch && <button type="button" className="eumk-btn" onClick={onSwitch}>Сменить пользователя</button>}
      </header>
      <main className="eumk-body">{children}</main>
    </div>
  );
}

export default function EumkRuntime({ properties }: Props) {
  const parsed = useMemo(() => EumkContentSchema.safeParse(properties.content), [properties.content]);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return (
      <Shell title={properties.title ?? 'ЭУМК'} user={null} onBack={null} onSwitch={null}>
        <div className="eumk-note bad" role="alert">
          <b>Содержимое комплекса не загружено.</b>
          <div>{first ? `${first.path.join(' / ')}: ${first.message}` : 'Нет данных.'}</div>
        </div>
      </Shell>
    );
  }
  return <Loaded key={parsed.data.id} content={parsed.data} />;
}

function Loaded({ content }: { content: EumkContent }) {
  const storage = useMemo(browserStorage, []);
  const initial = useMemo(() => (storage ? loadUserData(storage, content.id) : { status: 'empty' as const, data: { schemaVersion: 1 as const, accounts: [], results: [], taskProgress: {}, soundOn: true } }), [storage, content.id]);
  const [data, setData] = useState<EumkUserData>(initial.data);
  const [corrupt, setCorrupt] = useState(initial.status === 'corrupt');
  const [saveFailed, setSaveFailed] = useState(false);
  const [accountId, setAccountId] = useState<string | null>(null);
  const [section, setSection] = useState<Section | null>(null);

  const commit = useCallback((next: EumkUserData) => {
    setData(next);
    if (storage) setSaveFailed(!saveUserData(storage, content.id, next));
  }, [storage, content.id]);

  const account = data.accounts.find((a) => a.id === accountId) ?? null;

  if (!account) {
    return (
      <Shell title={content.title} user={null} onBack={null} onSwitch={null}>
        {saveFailed && <div className="eumk-note bad" role="alert">Не удалось сохранить данные на этом компьютере.</div>}
        <AccountScreen title={content.title} accounts={data.accounts} corrupt={corrupt}
          onSelect={(id) => { setAccountId(id); setSection(null); }}
          onCreate={(name) => {
            try {
              const created = addAccount(data, name, Date.now());
              commit(created.data);
              setCorrupt(false);
              setAccountId(created.account.id);
              return null;
            } catch (e) {
              return e instanceof Error ? e.message : 'Не удалось создать запись';
            }
          }}
          onRemove={(id) => commit(removeAccount(data, id))} />
      </Shell>
    );
  }

  const progress = data.taskProgress[account.id] ?? {};
  let body: React.ReactNode;
  switch (section) {
    case 'theory': body = <TheoryScreen content={content} />; break;
    case 'test': body = <TestScreen content={content} accountId={account.id} previousSignatures={signaturesFor(data, account.id)} onFinish={(r) => commit(recordResult(data, r))} onExit={() => setSection(null)} />; break;
    case 'tasks': body = <TasksScreen content={content} progress={progress} onDone={(id, ok) => commit(markTask(data, account.id, id, ok || !!progress[id]))} />; break;
    case 'games': body = <GamesScreen content={content} />; break;
    case 'cases': body = <CasesScreen content={content} />; break;
    case 'references': body = <ReferencesScreen content={content} />; break;
    case 'results': body = <ResultsScreen results={resultsFor(data, account.id)} />; break;
    default: body = <HomeScreen content={content} onOpen={setSection} tasksDone={Object.values(progress).filter(Boolean).length} />;
  }
  return (
    <Shell title={section ? `${content.title}: ${SECTION_TITLES[section]}` : content.title} user={account.name} onBack={section ? () => setSection(null) : null} onSwitch={() => { setAccountId(null); setSection(null); }}>
      {saveFailed && <div className="eumk-note bad" role="alert">Не удалось сохранить данные на этом компьютере. Результаты могут пропасть после закрытия приложения.</div>}
      <ErrorBoundary key={section ?? 'home'} label="Этот раздел не удалось открыть. Остальные разделы работают." onReset={() => setSection(null)}>{body}</ErrorBoundary>
    </Shell>
  );
}
