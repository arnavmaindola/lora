import { useCallback, useEffect, useMemo, useState } from "react";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";
const POLL_INTERVAL_MS = 5000;

const statusClasses = {
  online: "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40",
  offline: "bg-rose-500/20 text-rose-300 border border-rose-500/40",
  checking: "bg-amber-500/20 text-amber-300 border border-amber-500/40",
};

function StatusChip({ label, state }) {
  return (
    <div className={`px-3 py-1 rounded-full text-sm font-medium capitalize ${statusClasses[state] || statusClasses.checking}`}>
      {label}: {state}
    </div>
  );
}

function EmptyState({ title, subtitle }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center text-slate-400">
      <p className="text-lg font-semibold">{title}</p>
      {subtitle && <p className="mt-2 text-sm">{subtitle}</p>}
    </div>
  );
}

export default function App() {
  const [events, setEvents] = useState([]);
  const [images, setImages] = useState([]);
  const [totalEvents, setTotalEvents] = useState(0);
  const [status, setStatus] = useState("checking");
  const [logLoading, setLogLoading] = useState(true);
  const [imageLoading, setImageLoading] = useState(true);
  const [logsRefreshing, setLogsRefreshing] = useState(false);
  const [imagesRefreshing, setImagesRefreshing] = useState(false);
  const [logsError, setLogsError] = useState(null);
  const [imagesError, setImagesError] = useState(null);
  const [modalImage, setModalImage] = useState(null);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/status`);
      setStatus(res.ok ? "online" : "offline");
    } catch (err) {
      console.error("Status check failed", err);
      setStatus("offline");
    }
  }, []);

  const fetchLogs = useCallback(async () => {
    setLogsRefreshing(true);
    if (events.length === 0) {
      setLogLoading(true);
    }
    try {
      const res = await fetch(`${API_BASE_URL}/api/logs`);
      if (!res.ok) throw new Error(`Logs request failed: ${res.status}`);
      const payload = await res.json();
      setEvents(payload.events ?? []);
      setTotalEvents(payload.total ?? payload.events?.length ?? 0);
      setLogsError(null);
    } catch (err) {
      console.error(err);
      setLogsError(err.message);
    } finally {
      setLogLoading(false);
      setLogsRefreshing(false);
    }
  }, [events.length]);

  const fetchImages = useCallback(async () => {
    setImagesRefreshing(true);
    if (images.length === 0) {
      setImageLoading(true);
    }
    try {
      const res = await fetch(`${API_BASE_URL}/api/images`);
      if (!res.ok) throw new Error(`Images request failed: ${res.status}`);
      const payload = await res.json();
      const mapped = (payload.images ?? []).map((img) => ({
        ...img,
        fullUrl: `${API_BASE_URL}${img.url}`,
      }));
      setImages(mapped);
      setImagesError(null);
    } catch (err) {
      console.error(err);
      setImagesError(err.message);
    } finally {
      setImageLoading(false);
      setImagesRefreshing(false);
    }
  }, [images.length]);

  const refreshAll = useCallback(() => {
    fetchStatus();
    fetchLogs();
    fetchImages();
  }, [fetchStatus, fetchLogs, fetchImages]);

  useEffect(() => {
    refreshAll();
    const interval = setInterval(refreshAll, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [refreshAll]);

  const lastEventTs = useMemo(() => events[0]?.timestamp, [events]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-8">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm uppercase tracking-widest text-slate-400">LoRa Surveillance</p>
            <h1 className="text-3xl font-semibold">Realtime Event Dashboard</h1>
            <p className="text-sm text-slate-400">Auto-refreshing every {POLL_INTERVAL_MS / 1000}s</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <StatusChip label="System" state={status} />
            <div className="rounded-lg border border-slate-800 bg-slate-900 px-4 py-2 text-sm text-slate-300">
              <span className="font-semibold text-white">{totalEvents}</span> events recorded
            </div>
          </div>
        </header>

        <section className="grid gap-6 md:grid-cols-5">
          <div className="md:col-span-3 rounded-2xl border border-slate-800 bg-slate-900/80 shadow-xl">
            <div className="border-b border-slate-800 px-6 py-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-semibold">Event Logs</h2>
                  {lastEventTs && (
                    <p className="text-xs text-slate-400">Last event: {new Date(lastEventTs).toLocaleString()}</p>
                  )}
                </div>
                <button
                  className="rounded-md border border-slate-700 px-3 py-1 text-xs font-semibold text-slate-200 hover:bg-slate-800"
                  onClick={refreshAll}
                >
                  Refresh now
                </button>
                {logsRefreshing && !logLoading && (
                  <span className="text-xs text-slate-400">Refreshing…</span>
                )}
              </div>
            </div>
            <div className="px-6 py-4">
              {logLoading && <EmptyState title="Loading event logs" subtitle="Fetching recent triggers..." />}
              {!logLoading && logsError && <EmptyState title="Unable to load logs" subtitle={logsError} />}
              {!logLoading && !logsError && events.length === 0 && <EmptyState title="No events yet" subtitle="Waiting for the first LoRa trigger" />}
              {!logLoading && !logsError && events.length > 0 && (
                <div className="overflow-x-auto">
                  <table className="min-w-full text-left text-sm">
                    <thead className="text-slate-400">
                      <tr>
                        <th className="px-3 py-2">Timestamp</th>
                        <th className="px-3 py-2">Sensor ID</th>
                        <th className="px-3 py-2">Event Type</th>
                        <th className="px-3 py-2">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800">
                      {events.map((event) => (
                        <tr key={`${event.timestamp}-${event.sensor_id}`} className="hover:bg-slate-800/40">
                          <td className="px-3 py-2 text-slate-200">{new Date(event.timestamp).toLocaleString()}</td>
                          <td className="px-3 py-2">{event.sensor_id}</td>
                          <td className="px-3 py-2 capitalize">{event.event_type}</td>
                          <td className="px-3 py-2">
                            <span className="rounded-full bg-slate-800 px-2 py-1 text-xs capitalize text-slate-200">
                              {event.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

          <div className="md:col-span-2 rounded-2xl border border-slate-800 bg-slate-900/80 shadow-xl">
            <div className="border-b border-slate-800 px-6 py-4">
              <h2 className="text-xl font-semibold">Screenshot Gallery</h2>
              <div className="flex items-center gap-2 text-xs text-slate-400">
                <p>Latest capture previews</p>
                {imagesRefreshing && !imageLoading && <span>Refreshing…</span>}
              </div>
            </div>
            <div className="px-6 py-4">
              {imageLoading && <EmptyState title="Loading screenshots" subtitle="Listing recent captures..." />}
              {!imageLoading && imagesError && <EmptyState title="Unable to load screenshots" subtitle={imagesError} />}
              {!imageLoading && !imagesError && images.length === 0 && <EmptyState title="No screenshots yet" subtitle="Images will appear as triggers arrive" />}
              {!imageLoading && !imagesError && images.length > 0 && (
                <div className="grid grid-cols-2 gap-3">
                  {images.map((image) => (
                    <button
                      key={image.filename}
                      className="group relative overflow-hidden rounded-xl border border-slate-800 bg-slate-950/40"
                      onClick={() => setModalImage(image)}
                    >
                      <img src={image.fullUrl} alt={image.filename} className="h-28 w-full object-cover transition-transform duration-300 group-hover:scale-105" />
                      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent px-2 pb-2 pt-6 text-left text-xs text-slate-100">
                        {new Date(image.timestamp).toLocaleString()}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </section>
      </div>

      {modalImage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 px-4" onClick={() => setModalImage(null)}>
          <div className="relative max-h-[90vh] max-w-4xl" onClick={(evt) => evt.stopPropagation()}>
            <button
              className="absolute -right-3 -top-3 rounded-full bg-slate-900 px-2 py-1 text-sm font-semibold text-white shadow-lg"
              onClick={() => setModalImage(null)}
            >
              Close
            </button>
            <img src={modalImage.fullUrl} alt={modalImage.filename} className="max-h-[80vh] rounded-xl border border-slate-700 object-contain" />
            <p className="mt-3 text-center text-sm text-slate-300">Captured {new Date(modalImage.timestamp).toLocaleString()}</p>
          </div>
        </div>
      )}
    </div>
  );
}
