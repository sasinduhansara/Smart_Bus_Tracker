import { useEffect, useState } from "react";
import AdminLayout from "../components/AdminLayout";
import { adminAPI } from "../services/api";

interface FleetBus {
  id: string;
  busNumber: string;
  routeNumber: string;
  driverName: string;
  driverPhone: string;
  driverNic: string;
  licenseNumber: string;
  status: string;
  employeeId: string;
  created_at: string;
}

interface FleetStats {
  total: number;
  active: number;
  inactive: number;
}

interface EditForm {
  busNumber: string;
  routeNumber: string;
  fullName: string;
  phone: string;
  licenseNumber: string;
}

export default function BusManagement() {
  const [fleet, setFleet] = useState<FleetBus[]>([]);
  const [stats, setStats] = useState<FleetStats>({
    total: 0,
    active: 0,
    inactive: 0,
  });
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [windowWidth, setWindowWidth] = useState(
    typeof window !== "undefined" ? window.innerWidth : 1200,
  );
  const [page, setPage] = useState(1);
  const rowsPerPage = 10;

  // ─── Edit Modal State ────────────────────────────────────────
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<EditForm>({
    busNumber: "",
    routeNumber: "",
    fullName: "",
    phone: "",
    licenseNumber: "",
  });
  const [saving, setSaving] = useState(false);

  // ─── Delete Confirm State ────────────────────────────────────
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    const handleResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    fetchFleet();
  }, []);

  const fetchFleet = async () => {
    setLoading(true);
    try {
      const res = await adminAPI.getBusFleet();
      const data = res.data.data;
      setFleet(data.fleet);
      setStats(data.stats);
    } catch (err) {
      console.error("Error fetching fleet data:", err);
    } finally {
      setLoading(false);
    }
  };

  // ─── Open Edit Modal ───────────────────────────────────────────
  const openEdit = (bus: FleetBus) => {
    setEditForm({
      busNumber: bus.busNumber,
      routeNumber: bus.routeNumber,
      fullName: bus.driverName,
      phone: bus.driverPhone,
      licenseNumber: bus.licenseNumber,
    });
    setEditingId(bus.id);
  };

  const closeEdit = () => {
    setEditingId(null);
    setSaving(false);
  };

  // ─── Save Edit ─────────────────────────────────────────────────
  const handleSaveEdit = async () => {
    if (!editingId) return;
    setSaving(true);
    try {
      await adminAPI.updateBusFleet(editingId, {
        busNumber: editForm.busNumber,
        routeNumber: editForm.routeNumber,
        fullName: editForm.fullName,
        phone: editForm.phone,
        licenseNumber: editForm.licenseNumber,
      });
      closeEdit();
      fetchFleet();
    } catch (err: any) {
      alert(
        err.response?.data?.message || "Failed to update fleet entry",
      );
    } finally {
      setSaving(false);
    }
  };

  // ─── Delete ────────────────────────────────────────────────────
  const handleDelete = async (id: string) => {
    setDeleting(true);
    try {
      await adminAPI.deleteBusFleet(id);
      setDeleteConfirm(null);
      fetchFleet();
    } catch (err: any) {
      alert(
        err.response?.data?.message || "Failed to delete fleet entry",
      );
    } finally {
      setDeleting(false);
    }
  };

  const isMobile = windowWidth <= 768;
  const isTablet = windowWidth > 768 && windowWidth <= 1024;

  // Filter & paginate
  const filtered = fleet.filter((b) => {
    const q = searchTerm.toLowerCase();
    return (
      !q ||
      b.busNumber.toLowerCase().includes(q) ||
      b.routeNumber.toLowerCase().includes(q) ||
      b.driverName.toLowerCase().includes(q) ||
      b.driverPhone.includes(q) ||
      b.licenseNumber.toLowerCase().includes(q)
    );
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / rowsPerPage));
  const safePage = Math.min(page, totalPages);
  const paginated = filtered.slice(
    (safePage - 1) * rowsPerPage,
    safePage * rowsPerPage,
  );

  const getStatusStyle = (status: string) => {
    if (status === "approved") {
      return {
        label: "Active",
        backgroundColor: "#ECFDF5",
        color: "#065F46",
        dotColor: "#10B981",
      };
    }
    return {
      label: "Inactive",
      backgroundColor: "#FEE2E2",
      color: "#981B1B",
      dotColor: "#EF4444",
    };
  };

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((w) => w[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  // ─── Edit Modal Overlay ────────────────────────────────────────
  const renderEditModal = () => {
    if (!editingId) return null;
    return (
      <div
        style={{
          position: "fixed",
          inset: 0,
          backgroundColor: "rgba(0,0,0,0.4)",
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          zIndex: 1000,
        }}
        onClick={closeEdit}
      >
        <div
          style={{
            backgroundColor: "#FFFFFF",
            borderRadius: "16px",
            padding: "28px",
            width: "90%",
            maxWidth: "500px",
            boxShadow: "0 20px 60px rgba(0,0,0,0.2)",
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "20px",
            }}
          >
            <h3
              style={{
                margin: 0,
                fontSize: "18px",
                fontWeight: "700",
                color: "#1E293B",
              }}
            >
              ✏️ Edit Fleet Entry
            </h3>
            <button
              onClick={closeEdit}
              style={{
                background: "none",
                border: "none",
                fontSize: "20px",
                cursor: "pointer",
                color: "#94A3B8",
              }}
            >
              ✕
            </button>
          </div>

          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "14px",
            }}
          >
            <div>
              <label
                style={{
                  fontSize: "12px",
                  fontWeight: "600",
                  color: "#64748B",
                  marginBottom: "4px",
                  display: "block",
                }}
              >
                Bus Number
              </label>
              <input
                value={editForm.busNumber}
                onChange={(e) =>
                  setEditForm((f) => ({
                    ...f,
                    busNumber: e.target.value.toUpperCase(),
                  }))
                }
                style={{
                  width: "100%",
                  padding: "10px 14px",
                  fontSize: "14px",
                  border: "1px solid #D1D5DB",
                  borderRadius: "8px",
                  boxSizing: "border-box",
                }}
              />
            </div>

            <div>
              <label
                style={{
                  fontSize: "12px",
                  fontWeight: "600",
                  color: "#64748B",
                  marginBottom: "4px",
                  display: "block",
                }}
              >
                Route Number
              </label>
              <input
                value={editForm.routeNumber}
                onChange={(e) =>
                  setEditForm((f) => ({
                    ...f,
                    routeNumber: e.target.value.toUpperCase(),
                  }))
                }
                style={{
                  width: "100%",
                  padding: "10px 14px",
                  fontSize: "14px",
                  border: "1px solid #D1D5DB",
                  borderRadius: "8px",
                  boxSizing: "border-box",
                }}
              />
            </div>

            <div>
              <label
                style={{
                  fontSize: "12px",
                  fontWeight: "600",
                  color: "#64748B",
                  marginBottom: "4px",
                  display: "block",
                }}
              >
                Driver Full Name
              </label>
              <input
                value={editForm.fullName}
                onChange={(e) =>
                  setEditForm((f) => ({ ...f, fullName: e.target.value }))
                }
                style={{
                  width: "100%",
                  padding: "10px 14px",
                  fontSize: "14px",
                  border: "1px solid #D1D5DB",
                  borderRadius: "8px",
                  boxSizing: "border-box",
                }}
              />
            </div>

            <div>
              <label
                style={{
                  fontSize: "12px",
                  fontWeight: "600",
                  color: "#64748B",
                  marginBottom: "4px",
                  display: "block",
                }}
              >
                Phone Number
              </label>
              <input
                value={editForm.phone}
                onChange={(e) =>
                  setEditForm((f) => ({ ...f, phone: e.target.value }))
                }
                style={{
                  width: "100%",
                  padding: "10px 14px",
                  fontSize: "14px",
                  border: "1px solid #D1D5DB",
                  borderRadius: "8px",
                  boxSizing: "border-box",
                }}
              />
            </div>

            <div>
              <label
                style={{
                  fontSize: "12px",
                  fontWeight: "600",
                  color: "#64748B",
                  marginBottom: "4px",
                  display: "block",
                }}
              >
                License Number
              </label>
              <input
                value={editForm.licenseNumber}
                onChange={(e) =>
                  setEditForm((f) => ({
                    ...f,
                    licenseNumber: e.target.value.toUpperCase(),
                  }))
                }
                style={{
                  width: "100%",
                  padding: "10px 14px",
                  fontSize: "14px",
                  border: "1px solid #D1D5DB",
                  borderRadius: "8px",
                  boxSizing: "border-box",
                }}
              />
            </div>
          </div>

          <div
            style={{
              display: "flex",
              gap: "12px",
              justifyContent: "flex-end",
              marginTop: "24px",
            }}
          >
            <button
              onClick={closeEdit}
              style={{
                padding: "10px 20px",
                borderRadius: "8px",
                border: "1px solid #E2E8F0",
                background: "white",
                fontSize: "13px",
                fontWeight: "600",
                cursor: "pointer",
                color: "#64748B",
              }}
            >
              Cancel
            </button>
            <button
              onClick={handleSaveEdit}
              disabled={saving}
              style={{
                padding: "10px 24px",
                borderRadius: "8px",
                border: "none",
                background: saving ? "#94A3B8" : "#00468C",
                fontSize: "13px",
                fontWeight: "700",
                cursor: saving ? "not-allowed" : "pointer",
                color: "white",
              }}
            >
              {saving ? "Saving..." : "💾 Save Changes"}
            </button>
          </div>
        </div>
      </div>
    );
  };

  // ─── Delete Confirm Overlay ─────────────────────────────────────
  const renderDeleteConfirm = () => {
    if (!deleteConfirm) return null;
    const bus = fleet.find((b) => b.id === deleteConfirm);
    return (
      <div
        style={{
          position: "fixed",
          inset: 0,
          backgroundColor: "rgba(0,0,0,0.4)",
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          zIndex: 1000,
        }}
        onClick={() => !deleting && setDeleteConfirm(null)}
      >
        <div
          style={{
            backgroundColor: "#FFFFFF",
            borderRadius: "16px",
            padding: "28px",
            width: "90%",
            maxWidth: "400px",
            boxShadow: "0 20px 60px rgba(0,0,0,0.2)",
            textAlign: "center",
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div style={{ fontSize: "48px", marginBottom: "12px" }}>⚠️</div>
          <h3
            style={{
              margin: "0 0 8px 0",
              fontSize: "18px",
              fontWeight: "700",
              color: "#1E293B",
            }}
          >
            Delete Fleet Entry?
          </h3>
          <p
            style={{
              margin: "0 0 20px 0",
              fontSize: "14px",
              color: "#64748B",
              lineHeight: "1.5",
            }}
          >
            This will permanently remove{" "}
            <strong>{bus?.driverName || "this driver"}</strong> (Bus:{" "}
            {bus?.busNumber}) from the system.
          </p>
          <div style={{ display: "flex", gap: "12px", justifyContent: "center" }}>
            <button
              onClick={() => setDeleteConfirm(null)}
              disabled={deleting}
              style={{
                padding: "10px 20px",
                borderRadius: "8px",
                border: "1px solid #E2E8F0",
                background: "white",
                fontSize: "13px",
                fontWeight: "600",
                cursor: deleting ? "not-allowed" : "pointer",
                color: "#64748B",
              }}
            >
              Cancel
            </button>
            <button
              onClick={() => handleDelete(deleteConfirm)}
              disabled={deleting}
              style={{
                padding: "10px 24px",
                borderRadius: "8px",
                border: "none",
                background: deleting ? "#FCA5A5" : "#EF4444",
                fontSize: "13px",
                fontWeight: "700",
                cursor: deleting ? "not-allowed" : "pointer",
                color: "white",
              }}
            >
              {deleting ? "Deleting..." : "🗑️ Yes, Delete"}
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <AdminLayout
      title="Bus Management"
      showSearch
      searchPlaceholder="Search by bus, route, driver, phone..."
      searchValue={searchTerm}
      onSearchChange={(v) => {
        setSearchTerm(v);
        setPage(1);
      }}
    >
      {renderEditModal()}
      {renderDeleteConfirm()}

      <div
        style={{
          padding: "24px",
          display: "flex",
          flexDirection: "column",
          gap: "24px",
          width: "100%",
          boxSizing: "border-box",
        }}
      >
        {/* ═══ Stats Cards ═══ */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: isMobile
              ? "1fr"
              : isTablet
                ? "repeat(2, 1fr)"
                : "repeat(4, 1fr)",
            gap: "20px",
          }}
        >
          {[
            {
              title: "Total Fleet",
              value: stats.total,
              color: "#00468C",
              icon: "🚌",
            },
            {
              title: "Currently Active",
              value: stats.active,
              color: "#16A34A",
              icon: "✅",
            },
            {
              title: "Inactive",
              value: stats.inactive,
              color: "#DC2626",
              icon: "⛔",
            },
            {
              title: "Total Drivers",
              value: fleet.length,
              color: "#7C3AED",
              icon: "👤",
            },
          ].map((card, idx) => (
            <div
              key={idx}
              style={{
                background: "#FFFFFF",
                border: "1px solid #E5E7EB",
                borderRadius: "12px",
                padding: "20px",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                transition: "box-shadow 0.2s ease, transform 0.2s ease",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.boxShadow =
                  "0 4px 6px -1px rgba(0,0,0,0.1)";
                e.currentTarget.style.transform = "translateY(-2px)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.boxShadow = "none";
                e.currentTarget.style.transform = "translateY(0)";
              }}
            >
              <div>
                <p
                  style={{
                    fontSize: "13px",
                    fontWeight: "600",
                    color: "#64748B",
                    margin: "0 0 4px 0",
                  }}
                >
                  {card.title}
                </p>
                <p
                  style={{
                    fontSize: "28px",
                    fontWeight: "800",
                    color: card.color,
                    margin: 0,
                  }}
                >
                  {card.value}
                </p>
              </div>
              <div style={{ fontSize: "24px", opacity: 0.8 }}>
                {card.icon}
              </div>
            </div>
          ))}
        </div>

        {/* ═══ Fleet Table ═══ */}
        <div
          style={{
            background: "#FFFFFF",
            border: "1px solid #E5E7EB",
            borderRadius: "12px",
            padding: "20px",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "16px",
            }}
          >
            <h2
              style={{
                fontSize: "16px",
                fontWeight: "700",
                color: "#1E293B",
                margin: 0,
              }}
            >
              Fleet Overview
            </h2>
            <div style={{ display: "flex", gap: "10px" }}>
              <button
                style={{
                  background: "white",
                  border: "1px solid #E5E7EB",
                  padding: "8px 14px",
                  borderRadius: "6px",
                  fontSize: "13px",
                  fontWeight: "600",
                  cursor: "pointer",
                }}
              >
                🎛️ Filter
              </button>
              <button
                style={{
                  background: "white",
                  border: "1px solid #E5E7EB",
                  padding: "8px 14px",
                  borderRadius: "6px",
                  fontSize: "13px",
                  fontWeight: "600",
                  cursor: "pointer",
                }}
              >
                📥 Export
              </button>
            </div>
          </div>

          {loading ? (
            <div
              style={{
                textAlign: "center",
                padding: "60px 20px",
                color: "#94A3B8",
              }}
            >
              Loading fleet data...
            </div>
          ) : paginated.length === 0 ? (
            <div
              style={{
                textAlign: "center",
                padding: "60px 20px",
                color: "#94A3B8",
              }}
            >
              <div style={{ fontSize: "48px", marginBottom: "12px" }}>
                🚌
              </div>
              <h3 style={{ margin: "0 0 4px 0", color: "#1E293B" }}>
                No buses in fleet
              </h3>
              <p style={{ margin: 0, fontSize: "13px" }}>
                {searchTerm
                  ? "No buses match your search."
                  : "Register a driver with a bus assignment to see it here."}
              </p>
            </div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table
                style={{
                  width: "100%",
                  borderCollapse: "collapse",
                  textAlign: "left",
                }}
              >
                <thead>
                  <tr>
                    {[
                      "Bus Number",
                      "Driver Name",
                      "Route",
                      "Status",
                      "Contact",
                      "License",
                      "Actions",
                    ].map((h, i) => (
                      <th
                        key={h}
                        style={{
                          padding: "14px 16px",
                          backgroundColor: "#F8FAFC",
                          color: "#64748B",
                          fontSize: "12px",
                          fontWeight: "700",
                          textTransform: "uppercase",
                          borderBottom: "1px solid #E2E8F0",
                          textAlign: i === 6 ? "right" : "left",
                        }}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {paginated.map((bus) => {
                    const s = getStatusStyle(bus.status);
                    return (
                      <tr key={bus.id}>
                        <td
                          style={{
                            padding: "16px",
                            borderBottom: "1px solid #F1F5F9",
                            fontWeight: "700",
                            color: "#00468C",
                            fontSize: "14px",
                          }}
                        >
                          {bus.busNumber}
                        </td>
                        <td
                          style={{
                            padding: "16px",
                            borderBottom: "1px solid #F1F5F9",
                            color: "#334155",
                            fontSize: "14px",
                          }}
                        >
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: "8px",
                            }}
                          >
                            <div
                              style={{
                                width: "24px",
                                height: "24px",
                                borderRadius: "50%",
                                backgroundColor: "#E2E8F0",
                                fontSize: "10px",
                                fontWeight: "bold",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                color: "#475569",
                              }}
                            >
                              {getInitials(bus.driverName)}
                            </div>
                            {bus.driverName}
                          </div>
                        </td>
                        <td
                          style={{
                            padding: "16px",
                            borderBottom: "1px solid #F1F5F9",
                            color: "#334155",
                            fontSize: "14px",
                          }}
                        >
                          <span
                            style={{
                              border: "1px solid #00468C",
                              color: "#00468C",
                              padding: "2px 8px",
                              borderRadius: "12px",
                              fontSize: "12px",
                              fontWeight: "700",
                            }}
                          >
                            {bus.routeNumber}
                          </span>
                        </td>
                        <td
                          style={{
                            padding: "16px",
                            borderBottom: "1px solid #F1F5F9",
                            color: "#334155",
                            fontSize: "14px",
                          }}
                        >
                          <span
                            style={{
                              backgroundColor: s.backgroundColor,
                              color: s.color,
                              padding: "4px 10px",
                              borderRadius: "12px",
                              fontSize: "12px",
                              fontWeight: "600",
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "6px",
                            }}
                          >
                            <span
                              style={{
                                width: "6px",
                                height: "6px",
                                borderRadius: "50%",
                                backgroundColor: s.dotColor,
                              }}
                            />
                            {s.label}
                          </span>
                        </td>
                        <td
                          style={{
                            padding: "16px",
                            borderBottom: "1px solid #F1F5F9",
                            color: "#64748B",
                            fontSize: "13px",
                          }}
                        >
                          {bus.driverPhone}
                        </td>
                        <td
                          style={{
                            padding: "16px",
                            borderBottom: "1px solid #F1F5F9",
                            color: "#64748B",
                            fontSize: "12px",
                          }}
                        >
                          {bus.licenseNumber}
                        </td>
                        <td
                          style={{
                            padding: "16px",
                            borderBottom: "1px solid #F1F5F9",
                            color: "#334155",
                            fontSize: "16px",
                            textAlign: "right",
                          }}
                        >
                          <div
                            style={{
                              display: "flex",
                              gap: "4px",
                              justifyContent: "flex-end",
                            }}
                          >
                            <button
                              onClick={() => openEdit(bus)}
                              title="Edit"
                              style={{
                                background: "none",
                                border: "none",
                                cursor: "pointer",
                                fontSize: "16px",
                                padding: "4px 8px",
                                borderRadius: "6px",
                                color: "#00468C",
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.backgroundColor =
                                  "#EFF6FF";
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.backgroundColor =
                                  "transparent";
                              }}
                            >
                              ✏️
                            </button>
                            <button
                              onClick={() => setDeleteConfirm(bus.id)}
                              title="Delete"
                              style={{
                                background: "none",
                                border: "none",
                                cursor: "pointer",
                                fontSize: "16px",
                                padding: "4px 8px",
                                borderRadius: "6px",
                                color: "#DC2626",
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.backgroundColor =
                                  "#FEF2F2";
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.backgroundColor =
                                  "transparent";
                              }}
                            >
                              🗑️
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* ═══ Pagination ═══ */}
          {filtered.length > 0 && (
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginTop: "16px",
                fontSize: "13px",
                color: "#64748B",
              }}
            >
              <span>
                Showing{" "}
                {Math.min((safePage - 1) * rowsPerPage + 1, filtered.length)}
                {" – "}
                {Math.min(safePage * rowsPerPage, filtered.length)} of{" "}
                {filtered.length} buses
              </span>
              <div
                style={{
                  display: "flex",
                  gap: "6px",
                  alignItems: "center",
                }}
              >
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={safePage <= 1}
                  style={{
                    border: "none",
                    background: "none",
                    cursor: safePage <= 1 ? "not-allowed" : "pointer",
                    opacity: safePage <= 1 ? 0.3 : 1,
                    fontSize: "16px",
                  }}
                >
                  ◀
                </button>
                {Array.from({ length: totalPages }, (_, i) => i + 1)
                  .filter(
                    (p) =>
                      p === 1 ||
                      p === totalPages ||
                      Math.abs(p - safePage) <= 1,
                  )
                  .map((p, idx, arr) => (
                    <span
                      key={p}
                      style={{
                        display: "flex",
                        gap: "6px",
                        alignItems: "center",
                      }}
                    >
                      {idx > 0 && arr[idx - 1] !== p - 1 && (
                        <span style={{ color: "#94A3B8" }}>…</span>
                      )}
                      <button
                        onClick={() => setPage(p)}
                        style={{
                          backgroundColor:
                            p === safePage ? "#00468C" : "white",
                          color: p === safePage ? "white" : "#334155",
                          border:
                            p === safePage
                              ? "none"
                              : "1px solid #E5E7EB",
                          width: "28px",
                          height: "28px",
                          borderRadius: "4px",
                          fontWeight: p === safePage ? "bold" : "normal",
                          cursor: "pointer",
                        }}
                      >
                        {p}
                      </button>
                    </span>
                  ))}
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={safePage >= totalPages}
                  style={{
                    border: "none",
                    background: "none",
                    cursor: safePage >= totalPages ? "not-allowed" : "pointer",
                    opacity: safePage >= totalPages ? 0.3 : 1,
                    fontSize: "16px",
                  }}
                >
                  ▶
                </button>
              </div>
            </div>
          )}
        </div>

        {/* ═══ Bottom Map + Summary cards ═══ */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: isMobile || isTablet ? "1fr" : "2fr 1fr",
            gap: "24px",
          }}
        >
          <div
            style={{
              background: "#FFFFFF",
              border: "1px solid #E5E7EB",
              borderRadius: "16px",
              overflow: "hidden",
              position: "relative",
              minHeight: "280px",
            }}
          >
            <div
              style={{
                position: "absolute",
                inset: 0,
                backgroundColor: "#0F172A",
                backgroundImage:
                  "radial-gradient(#1E293B 1px, transparent 1px)",
                backgroundSize: "16px 16px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexDirection: "column",
              }}
            >
              <span
                style={{
                  position: "absolute",
                  top: "16px",
                  left: "16px",
                  backgroundColor: "white",
                  padding: "6px 12px",
                  borderRadius: "6px",
                  fontSize: "12px",
                  fontWeight: "700",
                  boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
                }}
              >
                📡 Real-time Fleet Map
              </span>
              <p style={{ color: "#475569", fontSize: "13px" }}>
                [ Map integration coming soon ]
              </p>
              <div
                style={{
                  position: "absolute",
                  bottom: "16px",
                  right: "16px",
                  display: "flex",
                  flexDirection: "column",
                  gap: "4px",
                }}
              >
                <button
                  style={{
                    width: "32px",
                    height: "32px",
                    borderRadius: "50%",
                    border: "none",
                    background: "white",
                    fontWeight: "bold",
                    cursor: "pointer",
                  }}
                >
                  +
                </button>
                <button
                  style={{
                    width: "32px",
                    height: "32px",
                    borderRadius: "50%",
                    border: "none",
                    background: "white",
                    fontWeight: "bold",
                    cursor: "pointer",
                  }}
                >
                  -
                </button>
              </div>
            </div>
          </div>

          <div
            style={{
              background: "#00468C",
              color: "#FFFFFF",
              borderRadius: "16px",
              padding: "24px",
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
            }}
          >
            <div>
              <h3
                style={{
                  margin: "0 0 6px 0",
                  fontSize: "16px",
                  fontWeight: "700",
                }}
              >
                Fleet Summary
              </h3>
              <p
                style={{
                  margin: 0,
                  fontSize: "12px",
                  opacity: 0.9,
                  lineHeight: "1.4",
                }}
              >
                {stats.active} bus{stats.active !== 1 ? "es" : ""} currently
                active out of {stats.total} total registered.
              </p>
            </div>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "10px",
                margin: "16px 0",
              }}
            >
              <div
                style={{
                  backgroundColor: "rgba(255,255,255,0.1)",
                  padding: "10px 12px",
                  borderRadius: "8px",
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                }}
              >
                <span>🚌</span>
                <div>
                  <p
                    style={{ margin: 0, fontSize: "13px", fontWeight: "700" }}
                  >
                    Total Fleet
                  </p>
                  <p style={{ margin: 0, fontSize: "11px", opacity: 0.8 }}>
                    {stats.total} registered
                  </p>
                </div>
              </div>
              <div
                style={{
                  backgroundColor: "rgba(255,255,255,0.1)",
                  padding: "10px 12px",
                  borderRadius: "8px",
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                }}
              >
                <span>✅</span>
                <div>
                  <p
                    style={{ margin: 0, fontSize: "13px", fontWeight: "700" }}
                  >
                    Active
                  </p>
                  <p style={{ margin: 0, fontSize: "11px", opacity: 0.8 }}>
                    {stats.active} running
                  </p>
                </div>
              </div>
            </div>
            <button
              style={{
                backgroundColor: "#F59E0B",
                color: "#1E293B",
                border: "none",
                width: "100%",
                padding: "12px",
                borderRadius: "8px",
                fontWeight: "700",
                cursor: "pointer",
                fontSize: "13px",
              }}
            >
              View All Drivers
            </button>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
