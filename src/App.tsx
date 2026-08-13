import { useState } from 'react';
import { BackupControls } from './components/BackupControls';
import { OptionsManager } from './components/OptionsManager';
import { CopyButton } from './components/CopyButton';
import { SubjectGrid } from './components/SubjectGrid';
import { TabBar } from './components/TabBar';
import { WeekBar } from './components/WeekBar';
import { PlanProvider, usePlan } from './store/PlanContext';
import type { TabId } from './types';
import { tabToTSV } from './utils/tsv';

function AppShell() {
  const { state, currentWeek } = usePlan();
  const [activeTab, setActiveTab] = useState<TabId>('IG1');
  const [managingSubjectId, setManagingSubjectId] = useState<string | null>(null);

  const subjectsInTab = state.subjects.filter((s) => s.tab === activeTab);

  return (
    <div className="app">
      <header className="app-header">
        <h1>Weekly Learning Plan Generator</h1>
        <WeekBar />
      </header>

      <div className="app-subheader">
        <p className="backup-reminder">
          Your data lives only in this browser — export a backup file regularly so a browser reset can't lose it.
        </p>
        <BackupControls />
      </div>

      <div className="app-toolbar">
        <TabBar activeTab={activeTab} onChange={setActiveTab} />
        <CopyButton label={`Copy whole ${activeTab} tab`} getText={() => tabToTSV(subjectsInTab, currentWeek)} />
      </div>

      <main className="app-main">
        {subjectsInTab.map((subject) => (
          <SubjectGrid key={subject.id} subject={subject} onManageOptions={setManagingSubjectId} />
        ))}
      </main>

      {managingSubjectId && (
        <OptionsManager initialSubjectId={managingSubjectId} onClose={() => setManagingSubjectId(null)} />
      )}
    </div>
  );
}

function App() {
  return (
    <PlanProvider>
      <AppShell />
    </PlanProvider>
  );
}

export default App;
