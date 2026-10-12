
import { useEffect, useMemo, useState } from "react";
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
} from "firebase/auth";
import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  query,
  updateDoc,
  deleteDoc,
  serverTimestamp,
} from "firebase/firestore";
import {
  ShieldCheck,
  LogOut,
  Package,
  Clock,
  CheckCircle,
  XCircle,
  MapPin,
  Phone,
  Search,
  RefreshCw,
  Trash2,
  ExternalLink,
} from "lucide-react";
import { auth, db } from "./config/Firebase";
import "./index.css";

export default function App() {
  const [user, setUser] = useState(null);
  const [authReady, setAuthReady] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [checkingRole, setCheckingRole] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [listings, setListings] = useState([]);
  const [filter, setFilter] = useState("pending");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState(null);
  const [rejectReason, setRejectReason] = useState("");
  const [busyId, setBusyId] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    return onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      setAuthReady(true);
      setIsAdmin(false);
      setListings([]);

      if (!currentUser) {
        setCheckingRole(false);
        return;
      }

      setCheckingRole(true);

      try {
        const roleRef = doc(db, "users", currentUser.uid);
        const roleSnap = await getDoc(roleRef);

        if (roleSnap.exists() && roleSnap.data().role === "admin") {
          setIsAdmin(true);
          setMessage("");
        } else {
          setMessage("This account is not authorized as an admin.");
          await signOut(auth);
        }
      } catch (error) {
        console.error(error);
        setMessage("Could not verify admin access. Check Firestore rules.");
        await signOut(auth);
      } finally {
        setCheckingRole(false);
      }
    });
  }, []);

  useEffect(() => {
    if (!user || !isAdmin) {
      setListings([]);
      return;
    }

    const q = query(collection(db, "listings"));

    return onSnapshot(
      q,
      (snapshot) => {
        const data = snapshot.docs.map((item) => ({
          id: item.id,
          ...item.data(),
        }));

        data.sort((a, b) => {
          const aTime = a.createdAt?.toMillis?.() || 0;
          const bTime = b.createdAt?.toMillis?.() || 0;
          return bTime - aTime;
        });

        setListings(data);
      },
      (error) => {
        console.error(error);
        setMessage("Could not load listings. Check Firestore rules.");
      }
    );
  }, [user, isAdmin]);

  async function login(event) {
    event.preventDefault();
    setMessage("");

    try {
      await signInWithEmailAndPassword(auth, email.trim(), password);
    } catch (error) {
      console.error(error);
      setMessage("Login failed. Check your email and password.");
    }
  }

  async function approveListing(item) {
    if (!window.confirm(`Approve "${item.productName}" for buyers?`)) return;

    setBusyId(item.id);
    setMessage("");

    try {
      await updateDoc(doc(db, "listings", item.id), {
        status: "approved",
        rejectionReason: "",
        reviewedAt: serverTimestamp(),
        reviewedBy: user.uid,
      });
      setSelected(null);
      setMessage("Listing approved. It can now appear on the buyer platform.");
    } catch (error) {
      console.error(error);
      setMessage("Approval failed. Check your Firestore security rules.");
    } finally {
      setBusyId("");
    }
  }

  async function rejectListing(item) {
    const reason = rejectReason.trim();

    if (!reason) {
      setMessage("Enter a reason before rejecting this listing.");
      return;
    }

    setBusyId(item.id);
    setMessage("");

    try {
      await updateDoc(doc(db, "listings", item.id), {
        status: "rejected",
        rejectionReason: reason,
        reviewedAt: serverTimestamp(),
        reviewedBy: user.uid,
      });
      setSelected(null);
      setRejectReason("");
      setMessage("Listing rejected. The reason has been saved.");
    } catch (error) {
      console.error(error);
      setMessage("Rejection failed. Check your Firestore security rules.");
    } finally {
      setBusyId("");
    }
  }

  async function removeListing(item) {
    if (
      !window.confirm(
        `Permanently delete "${item.productName}"? This cannot be undone.`
      )
    ) return;

    setBusyId(item.id);
    setMessage("");

    try {
      await deleteDoc(doc(db, "listings", item.id));
      setSelected(null);
      setMessage("Listing permanently deleted.");
    } catch (error) {
      console.error(error);
      setMessage("Delete failed. Check your Firestore security rules.");
    } finally {
      setBusyId("");
    }
  }

  const counts = useMemo(() => ({
    all: listings.length,
    pending: listings.filter((x) => x.status === "pending").length,
    approved: listings.filter((x) => x.status === "approved").length,
    rejected: listings.filter((x) => x.status === "rejected").length,
  }), [listings]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();

    return listings.filter((item) => {
      const status = item.status || "pending";
      const matchesFilter = filter === "all" || status === filter;
      const matchesSearch = !term || [
        item.productName,
        item.location,
        item.sellerPhone,
        item.sellerId,
      ].some((value) => String(value || "").toLowerCase().includes(term));

      return matchesFilter && matchesSearch;
    });
  }, [listings, filter, search]);

  if (!authReady || checkingRole) {
    return <main className="center">Checking secure admin access...</main>;
  }

  if (!user || !isAdmin) {
    return (
      <main className="login-page">
        <form className="login-card" onSubmit={login}>
          <div className="shield"><ShieldCheck size={32} /></div>
          <h1>Broiler Soko</h1>
          <p className="muted">Administrator sign in</p>

          <label>Admin email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="username"
            required
          />

          <label>Password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            required
          />

          <button className="primary full" type="submit">
            Sign in securely
          </button>

          {message && <p className="notice">{message}</p>}
          <p className="login-note">
            Admin access is assigned through Firebase Console.
          </p>
        </form>
      </main>
    );
  }

  return (
    <div className="admin-app">
      <aside className="sidebar">
        <div className="brand">
          <div className="shield"><ShieldCheck size={26} /></div>
          <div>
            <strong>Broiler Soko</strong>
            <small>Admin control centre</small>
          </div>
        </div>

        <p className="side-label">MANAGEMENT</p>

        {[
          ["all", "All listings", Package],
          ["pending", "Pending review", Clock],
          ["approved", "Approved", CheckCircle],
          ["rejected", "Rejected", XCircle],
        ].map(([key, label, Icon]) => (
          <button
            key={key}
            className={`nav-item ${filter === key ? "active" : ""}`}
            onClick={() => setFilter(key)}
          >
            <Icon size={18} />
            <span>{label}</span>
            <b>{counts[key]}</b>
          </button>
        ))}

        <div className="sidebar-bottom">
          <small>Signed in as</small>
          <p>{user.email}</p>
          <button className="logout" onClick={() => signOut(auth)}>
            <LogOut size={17} /> Sign out
          </button>
        </div>
      </aside>

      <main className="admin-main">
        <header className="page-header">
          <div>
            <p className="eyebrow">ADMINISTRATION</p>
            <h1>Listing management</h1>
            <p className="muted">
              Review seller submissions before they reach buyers.
            </p>
          </div>
          <button className="refresh" onClick={() => {
            setMessage("Listings update automatically in real time.");
          }}>
            <RefreshCw size={17} /> Live updates
          </button>
        </header>

        {message && (
          <div className="notice">
            {message}
            <button onClick={() => setMessage("")}>Dismiss</button>
          </div>
        )}

        <section className="stats">
          <div className="stat">
            <Package />
            <span>Total listings</span>
            <strong>{counts.all}</strong>
          </div>
          <div className="stat">
            <Clock />
            <span>Pending</span>
            <strong>{counts.pending}</strong>
          </div>
          <div className="stat">
            <CheckCircle />
            <span>Approved</span>
            <strong>{counts.approved}</strong>
          </div>
          <div className="stat">
            <XCircle />
            <span>Rejected</span>
            <strong>{counts.rejected}</strong>
          </div>
        </section>

        <section className="panel">
          <div className="toolbar">
            <div>
              <h2>
                {filter === "all"
                  ? "All listings"
                  : `${filter.charAt(0).toUpperCase()}${filter.slice(1)} listings`}
              </h2>
              <p className="muted">{filtered.length} listing(s) found</p>
            </div>
            <div className="search-box">
              <Search size={18} />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search product, town, phone..."
              />
            </div>
          </div>

          {filtered.length === 0 ? (
            <div className="empty">
              <Package size={36} />
              <h3>No listings found</h3>
              <p>New seller submissions will appear here automatically.</p>
            </div>
          ) : (
            <div className="listing-list">
              {filtered.map((item) => (
                <article className="listing" key={item.id}>
                  {item.imageUrl ? (
                    <img src={item.imageUrl} alt={item.productName || "Chicken"} />
                  ) : (
                    <div className="placeholder"><Package size={28} /></div>
                  )}

                  <div className="listing-info">
                    <span className={`status ${item.status || "pending"}`}>
                      {item.status || "pending"}
                    </span>
                    <h3>{item.productName || "Unnamed product"}</h3>
                    <p><MapPin size={14} /> {item.location || "No location"}</p>
                    <strong>
                      KSh {Number(item.pricePerKg || 0).toLocaleString()} / kg
                    </strong>
                    <small>
                      {item.quantityAvailable ?? 0} birds · Avg.{" "}
                      {item.averageWeightKg ?? "?"} kg
                    </small>
                    <small><Phone size={13} /> {item.sellerPhone || "No phone"}</small>
                    <small>Seller UID: {item.sellerId || "Unknown"}</small>

                    <div className="actions">
                      <button className="secondary" onClick={() => {
                        setSelected(item);
                        setRejectReason(item.rejectionReason || "");
                        setMessage("");
                      }}>
                        Review details
                      </button>

                      {item.status !== "approved" && (
                        <button
                          className="approve"
                          disabled={busyId === item.id}
                          onClick={() => approveListing(item)}
                        >
                          <CheckCircle size={16} /> Approve
                        </button>
                      )}

                      {item.status !== "rejected" && (
                        <button
                          className="reject"
                          onClick={() => {
                            setSelected(item);
                            setRejectReason("");
                            setMessage("");
                          }}
                        >
                          <XCircle size={16} /> Reject
                        </button>
                      )}
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
        <footer>Broiler Soko · Admin operations</footer>
      </main>

      {selected && (
        <div className="modal-backdrop" onClick={() => setSelected(null)}>
          <section className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-heading">
              <div>
                <p className="eyebrow">LISTING REVIEW</p>
                <h2>{selected.productName}</h2>
              </div>
              <button className="close" onClick={() => setSelected(null)}>×</button>
            </div>

            {selected.imageUrl && (
              <img className="review-image" src={selected.imageUrl} alt={selected.productName} />
            )}

            <p><b>Price:</b> KSh {selected.pricePerKg} per kg</p>
            <p><b>Average weight:</b> {selected.averageWeightKg} kg</p>
            <p><b>Quantity:</b> {selected.quantityAvailable} birds</p>
            <p><b>Location:</b> {selected.location}</p>
            <p><b>Seller phone:</b> {selected.sellerPhone}</p>
            <p><b>Seller UID:</b> {selected.sellerId}</p>
            <p><b>Description:</b> {selected.description || "No description provided"}</p>
            <p><b>Delivery:</b> {selected.deliveryAvailable ? "Available" : "Not available"}</p>
            <p><b>Collection:</b> {selected.collectionAvailable ? "Available" : "Not available"}</p>
            <p><b>Status:</b> {selected.status || "pending"}</p>

            {selected.imageUrl && (
              <a href={selected.imageUrl} target="_blank" rel="noreferrer">
                Open image <ExternalLink size={14} />
              </a>
            )}

            {selected.status !== "approved" && (
              <button
                className="approve full"
                disabled={busyId === selected.id}
                onClick={() => approveListing(selected)}
              >
                Approve listing
              </button>
            )}

            <label>Rejection reason</label>
            <textarea
              rows="3"
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="e.g. Please provide a valid phone number or current stock details."
            />
            <button
              className="reject full"
              disabled={busyId === selected.id}
              onClick={() => rejectListing(selected)}
            >
              Reject listing
            </button>

            <button
              className="delete full"
              disabled={busyId === selected.id}
              onClick={() => removeListing(selected)}
            >
              <Trash2 size={16} /> Permanently delete listing
            </button>
          </section>
        </div>
      )}
    </div>
  );
}
