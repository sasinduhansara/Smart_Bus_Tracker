import { useEffect, useState } from "react";
import AdminLayout from "../components/AdminLayout";
import { adminAPI } from "../services/api";

interface BusRegistration {
  id: string;
  busNumber: string;
  routeNumber: string;
  phone: string;
  nic: string;
  licenseNumber: string;
  fullName: string;
  status: string;
  created_at: string;
}

export default function BusRegistrationPage() {
  const [registrations, setRegistrations] = useState<BusRegistration[]>([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  // Form states
  const [busNumber, setBusNumber] = useState("");
  const [routeNumber, setRouteNumber] = useState("");
  const [phone, setPhone] = useState("");
  const [nic, setNic] = useState("");
  const [licenseNumber, setLicenseNumber] = useState("");
  const [fullName, setFullName] = useState("");
  const [formError, setFormError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchRegistrations();
  }, []);

  const fetchRegistrations = async () => {
    setLoading(true);
    try {
      const res = await adminAPI.getBusRegistrations({ status: "pending" });
      setRegistrations(res.data.data.registrations);
    } catch (err) {
      console.error("Error fetching registrations:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateRegistration = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");

    if (!busNumber.trim() || !routeNumber.trim() || !phone.trim()) {
      setFormError("Bus Number, Route Number, and Phone are required");
      return;
    }
    if (!nic.trim() && !licenseNumber.trim()) {
      setFormError("NIC or Driving License Number is required");
      return;
    }

    setSubmitting(true);
    try {
      await adminAPI.createBusRegistration({
        busNumber: busNumber.trim().toUpperCase(),
        routeNumber: routeNumber.trim().toUpperCase(),
        phone: phone.trim(),
        nic: nic.trim().toUpperCase(),
        licenseNumber: licenseNumber.trim().toUpperCase(),
        fullName: fullName.trim(),
      });

      // Reset form
      setBusNumber("");
      setRouteNumber("");
      setPhone("");
      setNic("");
      setLicenseNumber("");
      setFullName("");
      setShowForm(false);
      fetchRegistrations();
      alert("✅ Bus pre-registered successfully!");
    } catch (err: any) {
      setFormError(err.response?.data?.message || "Failed to create registration");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string, busNumber: string) => {
    if (!confirm(`Delete registration for bus ${busNumber}?`)) return;
    try {
      await adminAPI.deleteBusRegistration(id);
      fetchRegistrations();
    } catch (err: any) {
      alert(err.response?.data?.message || "Failed to delete");
    }
  };

  return (
    <AdminLayout
      title="Bus Pre-Registration"
      showSearch
      searchPlaceholder="Search by bus, route, phone, NIC..."
      searchValue={searchTerm}
      onSearchChange={setSearchTerm}
    >
      <div style={{ padding: "24px", display: "flex", flexDirection: "column", gap: "20px" }}>
        {/* ─── Header ─── */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <h2 style={{ fontSize: "24px", fontWeight: "800", color: "#1E293B", margin: "0 0 4px 0" }}>
              Bus Pre-Registration
            </h2>
            <p style={{ fontSize: "13px", color: "#64748B", margin: 0 }}>
              Pre-register buses with driver details for self-registration
            </p>
          </div>
          <button
            onClick={() => setShowForm(!showForm)}
            style={{
              backgroundColor: showForm ? "#EF4444" : "#0056B3",
              color: "white",
              border: "none",
              padding: "12px 20px",
              borderRadius: "8px",
              fontWeight: "700",
              cursor: "pointer",
              fontSize: "14px",
              display: "flex",
              alignItems: "center",
              gap: "6px",
            }}
          >
            {showForm ? "✕ Close Form" : "+ New Registration"}
          </button>
        </div>

        {/* ─── Registration Form ─── */}
        {showForm && (
          <div style={{
            background: "#FFFFFF",
            border: "1px solid #E2E8F0",
            borderRadius: "14px",
            padding: "28px",
            boxShadow: "0 4px 12px rgba(0,0,0,0.05)",
          }}>
            <h3 style={{ margin: "0 0 20px 0", fontSize: "18px", fontWeight: "700", color: "#1E293B" }}>
              Register New Bus for Driver Self-Registration
            </h3>

            {formError && (
              <div style={{
                backgroundColor: "#FEE2E2",
                color: "#DC2626",
                padding: "10px 14px",
                borderRadius: "8px",
                fontSize: "13px",
                fontWeight: "600",
                marginBottom: "16px",
                border: "1px solid #FCA5A5",
              }}>
                ⚠️ {formError}
              </div>
            )}

            <form onSubmit={handleCreateRegistration} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
                <div>
                  <label style={{ fontSize: "13px", fontWeight: "600", color: "#374151", display: "block", marginBottom: "4px" }}>
                    Bus Number *
                  </label>
                  <input
                    value={busNumber}
                    onChange={(e) => setBusNumber(e.target.value.toUpperCase())}
                    placeholder="e.g., NB-1234"
                    style={{
                      width: "100%", padding: "10px 14px", fontSize: "14px",
                      border: "1px solid #D1D5DB", borderRadius: "8px", boxSizing: "border-box"
                    }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: "13px", fontWeight: "600", color: "#374151", display: "block", marginBottom: "4px" }}>
                    Route Number *
                  </label>
                  <input
                    value={routeNumber}
                    onChange={(e) => setRouteNumber(e.target.value.toUpperCase())}
                    placeholder="e.g., 138"
                    style={{
                      width: "100%", padding: "10px 14px", fontSize: "14px",
                      border: "1px solid #D1D5DB", borderRadius: "8px", boxSizing: "border-box"
                    }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: "13px", fontWeight: "600", color: "#374151", display: "block", marginBottom: "4px" }}>
                    Phone Number *
                  </label>
                  <input
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="e.g., +94771234567"
                    style={{
                      width: "100%", padding: "10px 14px", fontSize: "14px",
                      border: "1px solid #D1D5DB", borderRadius: "8px", boxSizing: "border-box"
                    }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: "13px", fontWeight: "600", color: "#374151", display: "block", marginBottom: "4px" }}>
                    Driver Full Name
                  </label>
                  <input
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="e.g., Kamal Perera"
                    style={{
                      width: "100%", padding: "10px 14px", fontSize: "14px",
                      border: "1px solid #D1D5DB", borderRadius: "8px", boxSizing: "border-box"
                    }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: "13px", fontWeight: "600", color: "#374151", display: "block", marginBottom: "4px" }}>
                    NIC Number
                  </label>
                  <input
                    value={nic}
                    onChange={(e) => setNic(e.target.value.toUpperCase())}
                    placeholder="e.g., 200045600123"
                    style={{
                      width: "100%", padding: "10px 14px", fontSize: "14px",
                      border: "1px solid #D1D5DB", borderRadius: "8px", boxSizing: "border-box"
                    }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: "13px", fontWeight: "600", color: "#374151", display: "block", marginBottom: "4px" }}>
                    Driving License Number
                  </label>
                  <input
                    value={licenseNumber}
                    onChange={(e) => setLicenseNumber(e.target.value.toUpperCase())}
                    placeholder="e.g., B-12345"
                    style={{
                      width: "100%", padding: "10px 14px", fontSize: "14px",
                      border: "1px solid #D1D5DB", borderRadius: "8px", boxSizing: "border-box"
                    }}
                  />
                </div>
              </div>

              <div style={{ display: "flex", gap: "12px", justifyContent: "flex-end", marginTop: "8px" }}>
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  style={{
                    padding: "10px 20px",
                    border: "1px solid #D1D5DB",
                    borderRadius: "8px",
                    fontWeight: "600",
                    cursor: "pointer",
                    background: "white",
                    color: "#374151",
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  style={{
                    padding: "10px 24px",
                    backgroundColor: "#0056B3",
                    color: "white",
                    border: "none",
                    borderRadius: "8px",
                    fontWeight: "700",
                    cursor: "pointer",
                    opacity: submitting ? 0.7 : 1,
                  }}
                >
                  {submitting ? "Saving..." : "Register Bus"}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* ─── Info Notice ─── */}
        <div style={{
          background: "#EFF6FF",
          border: "1px solid #BFDBFE",
          borderRadius: "10px",
          padding: "14px 18px",
          display: "flex",
          alignItems: "flex-start",
          gap: "10px",
        }}>
          <span style={{ fontSize: "18px" }}>ℹ️</span>
          <div>
            <p style={{ margin: "0 0 2px 0", fontSize: "13px", fontWeight: "600", color: "#1E40AF" }}>
              How it works
            </p>
            <p style={{ margin: 0, fontSize: "12px", color: "#475569", lineHeight: "1.5" }}>
              1. Admin pre-registers bus details (Bus#, Route#, Phone, NIC/License) → 2. Driver uses these details to self-register via mobile app → 3. Driver verifies via OTP sent to this phone → 4. ID photo uploaded & auto-scanned → 5. Only matching NIC/License allows registration
            </p>
          </div>
        </div>

        {/* ─── Registrations Table ─── */}
        {loading ? (
          <div style={{ textAlign: "center", padding: "40px", color: "#94A3B8" }}>Loading...</div>
        ) : registrations.length === 0 ? (
          <div style={{
            textAlign: "center", padding: "60px 20px", color: "#94A3B8",
            background: "#FFFFFF", borderRadius: "14px", border: "1px solid #E2E8F0"
          }}>
            <div style={{ fontSize: "48px", marginBottom: "12px" }}>🚌</div>
            <h3 style={{ margin: "0 0 4px 0", color: "#1E293B" }}>No pre-registrations yet</h3>
            <p style={{ margin: 0, fontSize: "13px" }}>
              Click "New Registration" to pre-register a bus for driver self-registration.
            </p>
          </div>
        ) : (
          <div style={{
            background: "#FFFFFF", border: "1px solid #E2E8F0",
            borderRadius: "12px", overflow: "hidden"
          }}>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}>
                <thead>
                  <tr>
                    {["Bus Number", "Route", "Phone", "NIC", "License", "Full Name", "Status", "Date", "Actions"].map((h) => (
                      <th key={h} style={{
                        padding: "14px 16px", backgroundColor: "#F8FAFC",
                        color: "#64748B", fontSize: "12px", fontWeight: "700",
                        textTransform: "uppercase", borderBottom: "1px solid #E2E8F0"
                      }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {registrations
                    .filter(r => {
                      const q = searchTerm.toLowerCase();
                      return !q || r.busNumber.toLowerCase().includes(q) || 
                             r.routeNumber.toLowerCase().includes(q) ||
                             r.phone.includes(q) || r.nic.toLowerCase().includes(q) ||
                             r.licenseNumber.toLowerCase().includes(q) ||
                             (r.fullName || "").toLowerCase().includes(q);
                    })
                    .map((reg) => (
                    <tr key={reg.id}>
                      <td style={{ padding: "16px", borderBottom: "1px solid #F1F5F9", fontWeight: "700", color: "#0056B3" }}>
                        {reg.busNumber}
                      </td>
                      <td style={{ padding: "16px", borderBottom: "1px solid #F1F5F9", color: "#334155" }}>
                        <span style={{ border: "1px solid #0056B3", color: "#0056B3", padding: "2px 8px", borderRadius: "12px", fontSize: "12px", fontWeight: "700" }}>
                          {reg.routeNumber}
                        </span>
                      </td>
                      <td style={{ padding: "16px", borderBottom: "1px solid #F1F5F9", color: "#334155" }}>
                        {reg.phone}
                      </td>
                      <td style={{ padding: "16px", borderBottom: "1px solid #F1F5F9", color: "#334155", fontSize: "12px" }}>
                        {reg.nic || "—"}
                      </td>
                      <td style={{ padding: "16px", borderBottom: "1px solid #F1F5F9", color: "#334155", fontSize: "12px" }}>
                        {reg.licenseNumber || "—"}
                      </td>
                      <td style={{ padding: "16px", borderBottom: "1px solid #F1F5F9", color: "#334155" }}>
                        {reg.fullName || "—"}
                      </td>
                      <td style={{ padding: "16px", borderBottom: "1px solid #F1F5F9" }}>
                        <span style={{
                          padding: "4px 10px", borderRadius: "12px", fontSize: "11px", fontWeight: "700",
                          backgroundColor: reg.status === "pending" ? "#FEF3C7" : "#E2FBE8",
                          color: reg.status === "pending" ? "#92400E" : "#16A34A",
                        }}>
                          {reg.status === "pending" ? "⏳ Pending" : "✅ Completed"}
                        </span>
                      </td>
                      <td style={{ padding: "16px", borderBottom: "1px solid #F1F5F9", color: "#64748B", fontSize: "12px" }}>
                        {reg.created_at ? new Date(reg.created_at).toLocaleDateString() : "—"}
                      </td>
                      <td style={{ padding: "16px", borderBottom: "1px solid #F1F5F9" }}>
                        <button
                          onClick={() => handleDelete(reg.id, reg.busNumber)}
                          disabled={reg.status === "completed"}
                          style={{
                            background: "none", border: "none", cursor: reg.status === "completed" ? "not-allowed" : "pointer",
                            color: reg.status === "completed" ? "#CBD5E1" : "#EF4444", fontSize: "13px", fontWeight: "600",
                            padding: "4px 8px", borderRadius: "4px",
                          }}
                        >
                          🗑️ Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
