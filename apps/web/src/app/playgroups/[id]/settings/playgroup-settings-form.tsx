"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { MTG_FORMATS, FORMAT_LABELS, type MtgFormat } from "@/types/mtg";
import { AlertMessage } from "@/components/alert-message";

type Playgroup = {
  id: string;
  name: string;
  description: string | null;
  defaultFormat: string | null;
};

interface PlaygroupSettingsFormProps {
  playgroup: Playgroup;
  isOwner: boolean;
}

export function PlaygroupSettingsForm({
  playgroup,
  isOwner,
}: PlaygroupSettingsFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showDelete, setShowDelete] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    const formData = new FormData(e.currentTarget);
    const name = formData.get("name") as string;
    const description = formData.get("description") as string;
    const defaultFormat = formData.get("defaultFormat") as MtgFormat | "";

    startTransition(async () => {
      const response = await fetch(`/api/playgroups/${playgroup.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          description: description || null,
          defaultFormat: defaultFormat || null,
        }),
      });

      if (response.ok) {
        setSuccess("Settings saved successfully");
        router.refresh();
      } else {
        const data = await response.json();
        setError(data.error || "Failed to save settings");
      }
    });
  }

  async function handleDelete() {
    setError(null);
    startTransition(async () => {
      const response = await fetch(`/api/playgroups/${playgroup.id}`, {
        method: "DELETE",
      });

      if (response.ok) {
        router.push("/playgroups");
      } else {
        const data = await response.json();
        setError(data.error || "Failed to delete playgroup");
      }
    });
  }

  return (
    <>
      <form onSubmit={handleSubmit} className="space-y-6">
        {error && (
          <AlertMessage variant="error">{error}</AlertMessage>
        )}
        {success && (
          <AlertMessage variant="success">{success}</AlertMessage>
        )}

        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 space-y-4">
          {/* Name */}
          <div>
            <label
              htmlFor="name"
              className="block text-sm font-medium text-zinc-300 mb-2"
            >
              Playgroup Name *
            </label>
            <input
              type="text"
              id="name"
              name="name"
              required
              maxLength={100}
              defaultValue={playgroup.name}
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-3 text-zinc-100 focus:outline-none focus:border-amber-500 transition-colors"
            />
          </div>

          {/* Description */}
          <div>
            <label
              htmlFor="description"
              className="block text-sm font-medium text-zinc-300 mb-2"
            >
              Description
            </label>
            <textarea
              id="description"
              name="description"
              rows={3}
              defaultValue={playgroup.description || ""}
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-3 text-zinc-100 focus:outline-none focus:border-amber-500 transition-colors resize-none"
            />
          </div>

          {/* Default Format */}
          <div>
            <label
              htmlFor="defaultFormat"
              className="block text-sm font-medium text-zinc-300 mb-2"
            >
              Default Format
            </label>
            <select
              id="defaultFormat"
              name="defaultFormat"
              defaultValue={playgroup.defaultFormat || ""}
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-3 text-zinc-100 focus:outline-none focus:border-amber-500 transition-colors"
            >
              <option value="">No default format</option>
              {MTG_FORMATS.map((format) => (
                <option key={format} value={format}>
                  {FORMAT_LABELS[format]}
                </option>
              ))}
            </select>
          </div>
        </div>

        <button
          type="submit"
          disabled={isPending}
          className="w-full bg-amber-600 hover:bg-amber-500 disabled:bg-amber-800 disabled:cursor-not-allowed text-white py-3 rounded-lg transition-colors font-semibold"
        >
          {isPending ? "Saving..." : "Save Changes"}
        </button>
      </form>

      {/* Danger Zone */}
      {isOwner && (
        <div className="mt-12 pt-8 border-t border-zinc-800">
          <h2 className="text-lg font-semibold text-red-400 mb-4">
            Danger Zone
          </h2>
          <div className="bg-red-900/20 border border-red-900/50 rounded-xl p-5">
            <h3 className="font-medium text-red-300 mb-2">Delete Playgroup</h3>
            <p className="text-zinc-400 text-sm mb-4">
              This will permanently delete the playgroup, all games, and all
              associated data. This action cannot be undone.
            </p>
            {showDelete ? (
              <div className="flex items-center gap-3">
                <span className="text-red-300 text-sm">Are you sure?</span>
                <button
                  onClick={handleDelete}
                  disabled={isPending}
                  className="bg-red-600 hover:bg-red-500 disabled:bg-red-800 text-white px-4 py-2 rounded-lg transition-colors text-sm font-medium"
                >
                  {isPending ? "Deleting..." : "Yes, delete"}
                </button>
                <button
                  onClick={() => setShowDelete(false)}
                  className="text-zinc-400 hover:text-zinc-300 px-4 py-2 text-sm"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                onClick={() => setShowDelete(true)}
                className="text-red-400 hover:text-red-300 text-sm font-medium"
              >
                Delete Playgroup
              </button>
            )}
          </div>
        </div>
      )}
    </>
  );
}
