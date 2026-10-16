import { type ReactNode } from 'react';

export type Tab = {
  key: string;
  label: string;
  icon?: ReactNode;
  content: ReactNode;
};

export function Tabs({ tabs, activeKey, onChange }: { tabs: Tab[]; activeKey: string; onChange: (key: string) => void }) {
  return (
    <div>
      <div className="flex items-center gap-1 border-b border-edge overflow-x-auto scrollbar-thin">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => onChange(tab.key)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition-all relative whitespace-nowrap
              ${activeKey === tab.key ? 'text-gray-900' : 'text-gray-400 hover:text-gray-600'}`}
          >
            {tab.icon}
            {tab.label}
            {activeKey === tab.key && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-rayon-orange rounded-full" />
            )}
          </button>
        ))}
      </div>
      <div className="pt-5">
        {tabs.find((t) => t.key === activeKey)?.content}
      </div>
    </div>
  );
}
