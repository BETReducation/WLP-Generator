import type { TabId } from '../types';

const TABS: TabId[] = ['IG1', 'IG2', 'A-Level'];

interface TabBarProps {
  activeTab: TabId;
  onChange: (tab: TabId) => void;
}

export function TabBar({ activeTab, onChange }: TabBarProps) {
  return (
    <div className="tab-bar">
      {TABS.map((tab) => (
        <button
          key={tab}
          className={tab === activeTab ? 'tab-button tab-button-active' : 'tab-button'}
          onClick={() => onChange(tab)}
        >
          {tab}
        </button>
      ))}
    </div>
  );
}
