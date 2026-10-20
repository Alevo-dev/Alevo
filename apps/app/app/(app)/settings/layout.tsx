import { SettingsTabs } from "@/components/settings-tabs";

/** Settings: one title, tabbed sections (Qualifier, Knowledge, Members, …). */
export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div>
      <h1 className="text-title font-semibold text-ink">Settings</h1>
      <SettingsTabs />
      <div className="mt-8">{children}</div>
    </div>
  );
}
