"use client";
import { useState } from "react";

export default function SettingsPage() {
  const [settings, setSettings] = useState({
    notifications: true,
    emailAlerts: false,
    darkMode: true,
    language: "en",
  });

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold mb-2">Settings</h2>
        <p className="text-zinc-400">Manage your preferences and application settings</p>
      </div>

      <div className="bg-zinc-900 border border-zinc-800 p-8 rounded-xl space-y-6">
        <h3 className="text-lg font-semibold mb-4">General Settings</h3>
        
        <div className="space-y-4">
          <div className="flex items-center justify-between py-3 border-b border-zinc-800">
            <div>
              <div className="font-medium">Notifications</div>
              <div className="text-sm text-zinc-400">Receive in-app notifications</div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={settings.notifications}
                onChange={(e) => setSettings({ ...settings, notifications: e.target.checked })}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-zinc-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
            </label>
          </div>

          <div className="flex items-center justify-between py-3 border-b border-zinc-800">
            <div>
              <div className="font-medium">Email Alerts</div>
              <div className="text-sm text-zinc-400">Receive email notifications for important updates</div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={settings.emailAlerts}
                onChange={(e) => setSettings({ ...settings, emailAlerts: e.target.checked })}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-zinc-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
            </label>
          </div>

          <div className="flex items-center justify-between py-3 border-b border-zinc-800">
            <div>
              <div className="font-medium">Dark Mode</div>
              <div className="text-sm text-zinc-400">Use dark theme (currently enabled by default)</div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={settings.darkMode}
                onChange={(e) => setSettings({ ...settings, darkMode: e.target.checked })}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-zinc-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
            </label>
          </div>

          <div className="flex items-center justify-between py-3">
            <div>
              <div className="font-medium">Language</div>
              <div className="text-sm text-zinc-400">Select your preferred language</div>
            </div>
            <select
              value={settings.language}
              onChange={(e) => setSettings({ ...settings, language: e.target.value })}
              className="bg-zinc-800 border border-zinc-700 text-white px-4 py-2 rounded-lg"
            >
              <option value="en">English</option>
              <option value="hi">हिन्दी (Hindi)</option>
            </select>
          </div>
        </div>
      </div>

      <div className="bg-zinc-900 border border-zinc-800 p-8 rounded-xl">
        <h3 className="text-lg font-semibold mb-4 text-red-400">Danger Zone</h3>
        <div className="space-y-4">
          <button className="px-6 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors">
            Delete All Contracts
          </button>
          <button className="ml-4 px-6 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors">
            Delete Account
          </button>
        </div>
      </div>
    </div>
  );
}
