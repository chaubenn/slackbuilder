import { X } from "lucide-react";
import { useState } from "react";
import { useAppStore } from "../../store/appStore";
import { PROVIDERS, type AiProviderId } from "../../lib/ai/types";

interface SettingsModalProps {
  open: boolean;
  onClose: () => void;
}

export function SettingsModal({ open, onClose }: SettingsModalProps) {
  const settings = useAppStore((s) => s.settings);
  const setSettings = useAppStore((s) => s.setSettings);
  const setProvider = useAppStore((s) => s.setProvider);
  const [showKey, setShowKey] = useState(false);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-[420px] rounded-xl bg-white p-5 shadow-2xl ring-1 ring-slate-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold text-slate-900">Settings</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        <div className="space-y-4">
          <label className="block">
            <span className="text-sm font-medium text-slate-700">Provider</span>
            <select
              value={settings.provider}
              onChange={(e) => setProvider(e.target.value as AiProviderId)}
              className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm focus:border-violet-400 focus:outline-none focus:ring-2 focus:ring-violet-100"
            >
              {Object.entries(PROVIDERS).map(([id, p]) => (
                <option key={id} value={id}>
                  {p.label}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="text-sm font-medium text-slate-700">Model</span>
            <input
              type="text"
              value={settings.model}
              onChange={(e) => setSettings({ model: e.target.value })}
              className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm font-mono focus:border-violet-400 focus:outline-none focus:ring-2 focus:ring-violet-100"
            />
          </label>

          <label className="block">
            <span className="text-sm font-medium text-slate-700">
              Base URL{" "}
              <span className="font-normal text-slate-400">(optional)</span>
            </span>
            <input
              type="text"
              value={settings.baseUrl ?? ""}
              placeholder={PROVIDERS[settings.provider].defaultBaseUrl}
              onChange={(e) => setSettings({ baseUrl: e.target.value })}
              className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm font-mono focus:border-violet-400 focus:outline-none focus:ring-2 focus:ring-violet-100"
            />
          </label>

          <label className="block">
            <span className="text-sm font-medium text-slate-700">API key</span>
            <div className="mt-1 flex items-center gap-2">
              <input
                type={showKey ? "text" : "password"}
                value={settings.apiKey}
                onChange={(e) => setSettings({ apiKey: e.target.value })}
                className="flex-1 rounded-lg border border-slate-200 px-2 py-1.5 text-sm font-mono focus:border-violet-400 focus:outline-none focus:ring-2 focus:ring-violet-100"
              />
              <button
                type="button"
                onClick={() => setShowKey((s) => !s)}
                className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs text-slate-600 hover:bg-slate-50 transition-colors"
              >
                {showKey ? "Hide" : "Show"}
              </button>
            </div>
            <p className="mt-1.5 text-xs text-slate-400">
              Stored locally on this machine. Sent only to the provider you
              select — never to Slackbuilder servers.
            </p>
          </label>
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg bg-violet-600 px-4 py-1.5 text-sm font-medium text-white transition-colors hover:bg-violet-700"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
