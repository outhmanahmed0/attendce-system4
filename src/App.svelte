<script>
  import { onMount } from "svelte";

  let token = "";
  let view = "welcome";
  let scannedCode = "";
  let garageName = "";
  let parkingTime = "";

  let manualName = "";
  let showManualInput = false;

  // Dynamic Departments System
  let departments = [];
  let currentDepartmentId = null;
  let editingDepartmentId = null;
  let editingName = "";

  // Load departments from localStorage or initialize defaults
  onMount(() => {
    const saved = localStorage.getItem("departments");
    if (saved) {
      departments = JSON.parse(saved);
    } else {
      departments = [
        {
          id: Date.now(),
          name: "Department 1",
          history: [
            {
              id: 101,
              location: "Central Garage",
              time: "Yesterday, 09:00 AM",
              status: "Present",
            },
          ],
        },
        {
          id: Date.now() + 1,
          name: "Department 2",
          history: [
            {
              id: 201,
              location: "Workshop Area",
              time: "Yesterday, 10:00 AM",
              status: "Late",
            },
          ],
        },
      ];
      saveDepartments();
    }
  });

  function saveDepartments() {
    localStorage.setItem("departments", JSON.stringify(departments));
  }

  // Get current department and history
  $: currentDepartment = departments.find((d) => d.id === currentDepartmentId);
  $: history = currentDepartment ? currentDepartment.history : [];

  // Helper: Format Time
  function getCurrentTimeStr() {
    return new Date().toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  }

  // Helper: Check if Late (8am - 3pm is NOT late)
  function determineStatus() {
    const now = new Date();
    const hours = now.getHours();
    if (hours >= 8 && hours < 15) {
      return "Present";
    }
    return "Late";
  }

  // --- STRICT REQUIRED FUNCTIONS ---
  function authenticate() {
    return new Promise((resolve, reject) => {
      my.getAuthCode({
        scopes: ["auth_base", "USER_ID"],
        success: (res) => {
          const authCode = res.authCode;

          fetch("https://its.mouamle.space/api/auth-with-superQi", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ token: authCode }),
          })
            .then((r) => {
              if (!r.ok) throw new Error("Auth API error " + r.status);
              return r.json();
            })
            .then((data) => {
              token = data.token;
              my.alert({ content: "Login successful" });
              resolve(token);
            })
            .catch((err) => {
              my.alert({
                content:
                  "Authentication failed: " +
                  (err && err.message ? err.message : JSON.stringify(err)),
              });
              reject(err);
            });
        },
        fail: (res) => {
          my.alert({ content: "getAuthCode failed: " + JSON.stringify(res) });
          reject(res);
        },
      });
    });
  }

  function pay() {
    fetch("https://its.mouamle.space/api/payment", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: token,
      },
    })
      .then((res) => res.json())
      .then((data) => {
        my.tradePay({
          paymentUrl: data.url,
          success: () => my.alert({ content: "Payment successful" }),
        });
      })
      .catch((err) => {
        my.alert({ content: "Payment failed" });
      });
  }

  function scan() {
    my.confirm({
      title: "Authentication required",
      content: "Allow authentication to proceed with scanning?",
      confirmButtonText: "Allow",
      cancelButtonText: "Cancel",
      success: (res) => {
        const allowed =
          res &&
          (res.confirm === true ||
            res === true ||
            res.confirm === "confirm" ||
            res.ok === true);
        if (!allowed) return;
        authenticate()
          .then(() => {
            my.scan({
              type: "qr",
              success: (res) => {
                scannedCode = res.code;
                my.alert({ content: "Scan successful" });

                fetch("https://its.mouamle.space/api/garage-info", {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/json",
                    Authorization: token,
                  },
                  body: JSON.stringify({ code: scannedCode }),
                })
                  .then((r) => r.json())
                  .then((data) => {
                    garageName = data.name || "Garage " + scannedCode;
                    parkingTime = data.parkingTime || "Checked In";

                    addToHistory("Unknown");

                    view = "details";
                  })
                  .catch(() => {
                    garageName = "Garage " + scannedCode;
                    parkingTime = "Checked In";

                    addToHistory("Unknown");

                    view = "details";
                  });
              },
              fail: () => my.alert({ content: "Scan failed" }),
            });
          })
          .catch(() =>
            my.alert({ content: "Authentication required to scan" }),
          );
      },
    });
  }

  function backToMain() {
    view = "main";
  }

  // Navigation & Logic
  function enterApp() {
    view = "department_select";
  }

  function selectDepartment(id) {
    currentDepartmentId = id;
    view = "main";
  }

  function backToDepartmentSelect() {
    view = "department_select";
  }

  function goToHistory() {
    view = "history";
  }

  function toggleManualInput() {
    showManualInput = !showManualInput;
  }

  function addToHistory(locationName) {
    const status = determineStatus();
    const newRecord = {
      id: Date.now(),
      location: locationName,
      time: "Today, " + getCurrentTimeStr(),
      status: status,
    };

    const dept = departments.find((d) => d.id === currentDepartmentId);
    if (dept) {
      dept.history = [newRecord, ...dept.history];
      departments = departments; // Trigger reactivity
      saveDepartments();
    }

    return newRecord;
  }

  function submitManualAttendance() {
    if (!manualName.trim()) {
      my.alert({ content: "Please enter your name." });
      return;
    }

    const record = addToHistory("Manual: " + manualName);

    my.alert({
      content: `Attendance registered for ${manualName}\nStatus: ${record.status}`,
    });

    garageName = "User: " + manualName;
    parkingTime = record.time;

    view = "details";
    manualName = "";
  }

  function reportDelay() {
    my.getLocation({
      type: 1,
      success: (res) => {
        console.log("Latitude:", res.latitude);
        console.log("Longitude:", res.longitude);
        console.log("Accuracy:", res.accuracy);

        const locStr = `${res.latitude.toFixed(6)}, ${res.longitude.toFixed(6)}`;

        my.alert({
          content: "Location sent to supervisor:\n" + locStr,
        });

        addToHistory("Delay reported: " + locStr);
      },
      fail: (err) => {
        my.alert({
          content: "Failed to get location: " + JSON.stringify(err),
        });
      },
    });
  }

  // Department Management
  function createDepartment() {
    const name = prompt("Enter department name:");
    if (name && name.trim()) {
      departments = [
        ...departments,
        {
          id: Date.now(),
          name: name.trim(),
          history: [],
        },
      ];
      saveDepartments();
    }
  }

  function startEdit(id, currentName) {
    editingDepartmentId = id;
    editingName = currentName;
  }

  function saveEdit() {
    if (editingName.trim()) {
      const dept = departments.find((d) => d.id === editingDepartmentId);
      if (dept) {
        dept.name = editingName.trim();
        departments = departments;
        saveDepartments();
      }
    }
    editingDepartmentId = null;
    editingName = "";
  }

  function cancelEdit() {
    editingDepartmentId = null;
    editingName = "";
  }

  function deleteDepartment(id) {
    if (departments.length <= 1) {
      my.alert({ content: "Cannot delete the last department!" });
      return;
    }

    my.confirm({
      title: "Delete Department",
      content:
        "Are you sure you want to delete this department? All history will be lost.",
      confirmButtonText: "Delete",
      cancelButtonText: "Cancel",
      success: (res) => {
        const confirmed =
          res &&
          (res.confirm === true ||
            res === true ||
            res.confirm === "confirm" ||
            res.ok === true);
        if (confirmed) {
          departments = departments.filter((d) => d.id !== id);
          saveDepartments();
        }
      },
    });
  }
</script>

<main class="container">
  <!-- WELCOME VIEW -->
  {#if view === "welcome"}
    <div class="view welcome-view">
      <div class="welcome-content">
        <div class="logo-circle">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="40"
            height="40"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            ><path d="M12 2L2 7l10 5 10-5-10-5z"></path><path
              d="M2 17l10 5 10-5"
            ></path><path d="M2 12l10 5 10-5"></path></svg
          >
        </div>
        <h1>Super Qi<br />Attendance</h1>
        <p class="subtitle">A program designed to record your attendance.</p>
        <button class="btn-primary-large" on:click={enterApp}
          >Get Started</button
        >
      </div>
    </div>

    <!-- DEPARTMENT SELECTION VIEW -->
  {:else if view === "department_select"}
    <div class="view department-select-view">
      <header class="department-header">
        <h1>Select Department</h1>
        <p>Where you want to record your attendance.</p>
      </header>

      <div class="department-grid">
        {#each departments as dept}
          <div class="department-card">
            {#if editingDepartmentId === dept.id}
              <div class="edit-mode">
                <input
                  type="text"
                  bind:value={editingName}
                  class="edit-input"
                  on:keydown={(e) => e.key === "Enter" && saveEdit()}
                />
                <div class="edit-actions">
                  <button class="btn-save" on:click={saveEdit}>
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="2"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      ><polyline points="20 6 9 17 4 12"></polyline></svg
                    >
                  </button>
                  <button class="btn-cancel" on:click={cancelEdit}>
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="2"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      ><line x1="18" y1="6" x2="6" y2="18"></line><line
                        x1="6"
                        y1="6"
                        x2="18"
                        y2="18"
                      ></line></svg
                    >
                  </button>
                </div>
              </div>
            {:else}
              <button
                class="dept-main"
                on:click={() => selectDepartment(dept.id)}
              >
                <div class="dept-icon">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="28"
                    height="28"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    ><rect x="3" y="3" width="7" height="7"></rect><rect
                      x="14"
                      y="3"
                      width="7"
                      height="7"
                    ></rect><rect x="14" y="14" width="7" height="7"
                    ></rect><rect x="3" y="14" width="7" height="7"></rect></svg
                  >
                </div>
                <h2>{dept.name}</h2>
                <p>{dept.history.length} records</p>
              </button>
              <div class="dept-controls">
                <button
                  class="btn-icon-sm"
                  on:click={() => startEdit(dept.id, dept.name)}
                  title="Edit name"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    ><path
                      d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"
                    ></path><path
                      d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"
                    ></path></svg
                  >
                </button>
                <button
                  class="btn-icon-sm btn-delete"
                  on:click={() => deleteDepartment(dept.id)}
                  title="Delete"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    ><polyline points="3 6 5 6 21 6"></polyline><path
                      d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"
                    ></path></svg
                  >
                </button>
              </div>
            {/if}
          </div>
        {/each}

        <!-- Create New Department Card -->
        <button class="department-card new-dept" on:click={createDepartment}>
          <div class="new-dept-icon">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="32"
              height="32"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
              ><line x1="12" y1="5" x2="12" y2="19"></line><line
                x1="5"
                y1="12"
                x2="19"
                y2="12"
              ></line></svg
            >
          </div>
          <h2>New Department</h2>
        </button>
      </div>
    </div>

    <!-- MAIN REGISTRATION VIEW -->
  {:else if view === "main"}
    <div class="view main-view">
      <header class="top-nav">
        <button class="section-badge" on:click={backToDepartmentSelect}>
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            ><polyline points="15 18 9 12 15 6"></polyline></svg
          >
          {currentDepartment?.name || "Department"}
        </button>
        <button class="btn-history-visible" on:click={goToHistory}>
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            ><path d="M12 8v4l3 3"></path><circle cx="12" cy="12" r="10"
            ></circle></svg
          >
          <span>History</span>
        </button>
      </header>

      <div class="content-center">
        <div class="manual-section-primary">
          <h2>Register by Name</h2>
          <div class="input-group-large">
            <input
              type="text"
              placeholder="Enter your name..."
              bind:value={manualName}
              class="input-large"
            />
            <button class="btn-confirm-large" on:click={submitManualAttendance}>
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
                ><polyline points="20 6 9 17 4 12"></polyline></svg
              >
            </button>
          </div>
        </div>

        <div class="divider">
          <span>OR</span>
        </div>

        <button class="btn-scan-secondary" on:click={scan}>
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            ><path d="M3 7V5a2 2 0 0 1 2-2h2"></path><path
              d="M17 3h2a2 2 0 0 1 2 2v2"
            ></path><path d="M21 17v2a2 2 0 0 1-2 2h-2"></path><path
              d="M7 21H5a2 2 0 0 1-2-2v-2"
            ></path></svg
          >
          Scan Attendance
        </button>

        <button class="btn-delay" on:click={reportDelay}>
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            ><circle cx="12" cy="12" r="10"></circle><line
              x1="12"
              y1="8"
              x2="12"
              y2="12"
            ></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg
          >
          Report Delay (Location)
        </button>
      </div>
    </div>

    <!-- HISTORY VIEW -->
  {:else if view === "history"}
    <div class="view history-view">
      <header class="top-nav">
        <button class="icon-btn" on:click={backToMain}>
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            ><line x1="19" y1="12" x2="5" y2="12"></line><polyline
              points="12 19 5 12 12 5"
            ></polyline></svg
          >
        </button>
        <h1>Records - {currentDepartment?.name || "Department"}</h1>
        <div style="width: 24px;"></div>
      </header>

      <ul class="history-list-modern">
        {#each history as item}
          <li class="history-card-item">
            <div class="info">
              <h3>{item.location}</h3>
              <span class="timestamp">{item.time}</span>
            </div>
            <div class="status-col">
              <span class="status-pill {item.status.toLowerCase()}"
                >{item.status}</span
              >
              {#if item.status === "Late"}
                <button class="btn-pay-fine" on:click={pay}
                  >Register Objection</button
                >
              {/if}
            </div>
          </li>
        {/each}
      </ul>
    </div>

    <!-- DETAILS VIEW -->
  {:else if view === "details"}
    <div class="view details-view">
      <div class="card details-card">
        <div class="icon-check-pulse">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="48"
            height="48"
            viewBox="0 0 24 24"
            fill="none"
            stroke="white"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            ><polyline points="20 6 9 17 4 12"></polyline></svg
          >
        </div>
        <h2>Attendance Recorded</h2>
        <div class="detail-row">
          <span class="label">Department</span>
          <span class="value">{currentDepartment?.name || "Unknown"}</span>
        </div>
        <div class="detail-row">
          <span class="label">Location / Name</span>
          <span class="value">{garageName}</span>
        </div>
        <div class="detail-row">
          <span class="label">Time</span>
          <span class="value">{parkingTime}</span>
        </div>

        <button class="btn-primary" on:click={backToMain}>Back to Home</button>
        <button class="btn-secondary" on:click={pay}
          >Register Objection (If applicable)</button
        >
      </div>
    </div>
  {/if}
</main>

<style>
  @import url("https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap");

  :global(body) {
    margin: 0;
    font-family: "Inter", sans-serif;
    background-color: #f8fafc;
    color: #1e293b;
    -webkit-font-smoothing: antialiased;
  }

  .container {
    max-width: 480px;
    margin: 0 auto;
    min-height: 100vh;
    background: #ffffff;
    box-shadow: 0 0 40px rgba(0, 0, 0, 0.05);
    position: relative;
    overflow: hidden;
  }

  .view {
    height: 100vh;
    display: flex;
    flex-direction: column;
    box-sizing: border-box;
    animation: fadeIn 0.4s ease forwards;
  }

  @keyframes fadeIn {
    from {
      opacity: 0;
      transform: translateY(10px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  /* --- WELCOME VIEW --- */
  .welcome-view {
    background: linear-gradient(145deg, #0f172a 0%, #1e293b 100%);
    color: white;
    justify-content: center;
    align-items: center;
    padding: 40px;
    text-align: center;
  }

  .logo-circle {
    width: 80px;
    height: 80px;
    background: linear-gradient(135deg, #3b82f6, #8b5cf6);
    border-radius: 50%;
    margin: 0 auto 24px;
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 10px 25px rgba(59, 130, 246, 0.4);
  }

  .welcome-view h1 {
    font-size: 32px;
    font-weight: 800;
    margin: 0 0 16px;
    line-height: 1.2;
    letter-spacing: -0.5px;
  }

  .subtitle {
    font-size: 16px;
    color: #94a3b8;
    margin-bottom: 48px;
  }

  .btn-primary-large {
    width: 100%;
    padding: 18px;
    background: white;
    color: #0f172a;
    border: none;
    border-radius: 16px;
    font-size: 18px;
    font-weight: 700;
    cursor: pointer;
    box-shadow: 0 4px 15px rgba(255, 255, 255, 0.1);
    transition: transform 0.2s;
  }
  .btn-primary-large:active {
    transform: scale(0.96);
  }

  /* --- DEPARTMENT SELECT VIEW --- */
  .department-select-view {
    background: #f8fafc;
    padding: 24px;
    overflow-y: auto;
  }

  .department-header {
    text-align: center;
    margin-bottom: 32px;
    padding-top: 16px;
  }

  .department-header h1 {
    font-size: 24px;
    font-weight: 700;
    color: #0f172a;
    margin: 0 0 8px 0;
  }

  .department-header p {
    color: #64748b;
    font-size: 14px;
    margin: 0;
  }

  .department-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
    gap: 16px;
    max-width: 600px;
    margin: 0 auto;
  }

  /* Mobile responsive: single column on small screens */
  @media (max-width: 400px) {
    .department-grid {
      grid-template-columns: 1fr;
    }

    .department-select-view {
      padding: 20px 16px;
    }
  }

  .department-card {
    background: white;
    border: 2px solid #e2e8f0;
    border-radius: 16px;
    padding: 20px 16px;
    position: relative;
    transition: all 0.2s;
  }

  .department-card:hover {
    border-color: #3b82f6;
    transform: translateY(-2px);
    box-shadow: 0 8px 20px rgba(59, 130, 246, 0.1);
  }

  .dept-main {
    background: none;
    border: none;
    width: 100%;
    text-align: center;
    cursor: pointer;
    padding: 0;
  }

  .dept-icon {
    width: 56px;
    height: 56px;
    background: linear-gradient(135deg, #dbeafe, #bfdbfe);
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    margin: 0 auto 12px;
    color: #2563eb;
  }

  .department-card h2 {
    font-size: 16px;
    font-weight: 600;
    color: #0f172a;
    margin: 0 0 6px 0;
  }

  .department-card p {
    font-size: 12px;
    color: #64748b;
    margin: 0;
  }

  .dept-controls {
    display: flex;
    gap: 8px;
    justify-content: center;
    margin-top: 12px;
    padding-top: 12px;
    border-top: 1px solid #f1f5f9;
  }

  .btn-icon-sm {
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    padding: 6px 10px;
    cursor: pointer;
    color: #64748b;
    transition: all 0.2s;
  }

  .btn-icon-sm:hover {
    background: #f1f5f9;
    color: #0f172a;
  }

  .btn-delete:hover {
    background: #fef2f2;
    color: #dc2626;
    border-color: #fecaca;
  }

  .new-dept {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    border-style: dashed;
    background: #f8fafc;
  }

  .new-dept:hover {
    background: white;
  }

  .new-dept-icon {
    width: 56px;
    height: 56px;
    background: linear-gradient(135deg, #f0fdf4, #dcfce7);
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    margin-bottom: 12px;
    color: #16a34a;
  }

  .edit-mode {
    padding: 8px 0;
  }

  .edit-input {
    width: 100%;
    padding: 8px 12px;
    border: 1px solid #3b82f6;
    border-radius: 8px;
    font-size: 14px;
    margin-bottom: 8px;
    outline: none;
  }

  .edit-actions {
    display: flex;
    gap: 8px;
    justify-content: center;
  }

  .btn-save,
  .btn-cancel {
    padding: 6px 12px;
    border-radius: 6px;
    border: none;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .btn-save {
    background: #22c55e;
    color: white;
  }

  .btn-cancel {
    background: #e2e8f0;
    color: #475569;
  }

  /* --- SHARED HEADER --- */
  .top-nav {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 20px 24px;
    background: rgba(255, 255, 255, 0.8);
    backdrop-filter: blur(10px);
    z-index: 10;
  }

  .top-nav h1 {
    font-size: 18px;
    font-weight: 600;
    margin: 0;
    color: #0f172a;
  }

  .icon-btn {
    background: none;
    border: none;
    padding: 8px;
    color: #64748b;
    cursor: pointer;
    transition: color 0.2s;
  }
  .icon-btn:hover {
    color: #0f172a;
  }

  .section-badge {
    display: flex;
    align-items: center;
    gap: 6px;
    background: #f1f5f9;
    border: 1px solid #e2e8f0;
    padding: 8px 12px;
    border-radius: 20px;
    color: #475569;
    font-weight: 600;
    font-size: 13px;
    cursor: pointer;
    transition: background 0.2s;
  }
  .section-badge:hover {
    background: #e2e8f0;
  }

  .btn-history-visible {
    display: flex;
    align-items: center;
    gap: 6px;
    background: #f1f5f9;
    border: none;
    padding: 8px 16px;
    border-radius: 20px;
    color: #0f172a;
    font-weight: 600;
    font-size: 14px;
    cursor: pointer;
    transition: background 0.2s;
  }
  .btn-history-visible:hover {
    background: #e2e8f0;
  }

  /* --- MAIN VIEW --- */
  .main-view {
    justify-content: flex-start;
  }

  .content-center {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 24px;
  }

  .manual-section-primary {
    width: 100%;
    background: white;
    padding: 24px;
    border-radius: 24px;
    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.05);
    text-align: center;
    border: 1px solid #f8fafc;
  }

  .manual-section-primary h2 {
    margin: 0 0 16px 0;
    font-size: 18px;
    font-weight: 600;
    color: #1e293b;
  }

  .input-group-large {
    display: flex;
    gap: 12px;
  }

  .input-large {
    flex: 1;
    padding: 14px 16px;
    border-radius: 12px;
    border: 1px solid #e2e8f0;
    background: #f8fafc;
    font-size: 16px;
    outline: none;
    transition: border-color 0.2s;
  }
  .input-large:focus {
    border-color: #3b82f6;
  }

  .btn-confirm-large {
    background: #0f172a;
    color: white;
    border: none;
    border-radius: 12px;
    width: 54px;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    box-shadow: 0 4px 12px rgba(15, 23, 42, 0.2);
  }

  .btn-scan-secondary {
    margin-top: 0;
    background: none;
    border: 2px dashed #94a3b8;
    color: #64748b;
    width: 100%;
    padding: 16px;
    border-radius: 16px;
    font-size: 16px;
    font-weight: 600;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 10px;
    cursor: pointer;
    transition: all 0.2s;
  }
  .btn-scan-secondary:hover {
    border-color: #3b82f6;
    color: #3b82f6;
    background: #eff6ff;
  }

  .btn-delay {
    margin-top: 24px;
    background: #fff7ed;
    color: #c2410c;
    border: 1px solid #ffedd5;
    padding: 10px 20px;
    border-radius: 12px;
    font-size: 14px;
    font-weight: 600;
    display: flex;
    align-items: center;
    gap: 8px;
    transition: all 0.2s;
  }
  .btn-delay:active {
    background: #ffedd5;
    transform: scale(0.98);
  }

  .divider {
    margin: 24px 0;
    position: relative;
    width: 100%;
    text-align: center;
  }
  .divider::before {
    content: "";
    position: absolute;
    top: 50%;
    left: 0;
    right: 0;
    height: 1px;
    background: #e2e8f0;
    z-index: 1;
  }
  .divider span {
    position: relative;
    z-index: 2;
    background: #ffffff;
    padding: 0 12px;
    color: #94a3b8;
    font-size: 14px;
    font-weight: 500;
  }

  /* --- HISTORY VIEW --- */
  .history-list-modern {
    list-style: none;
    padding: 24px;
    margin: 0;
    overflow-y: auto;
  }

  .history-card-item {
    background: white;
    padding: 20px;
    border-radius: 16px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.03);
    margin-bottom: 16px;
    border: 1px solid #f1f5f9;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .history-card-item .info h3 {
    margin: 0 0 6px 0;
    font-size: 16px;
    font-weight: 600;
    color: #1e293b;
  }
  .history-card-item .info .timestamp {
    font-size: 13px;
    color: #64748b;
  }

  .status-col {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 8px;
  }

  .status-pill {
    padding: 6px 12px;
    border-radius: 20px;
    font-size: 12px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }
  .status-pill.present {
    background-color: #dcfce7;
    color: #15803d;
  }
  .status-pill.late {
    background-color: #fee2e2;
    color: #b91c1c;
  }

  .btn-pay-fine {
    font-size: 12px;
    font-weight: 600;
    color: #ef4444;
    background: transparent;
    border: 1px solid #fecaca;
    padding: 6px 12px;
    border-radius: 8px;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .btn-pay-fine:active,
  .btn-pay-fine:focus {
    background-color: #fef08a;
    border-color: #eab308;
    color: #854d0e;
    transform: scale(0.95);
  }

  /* --- DETAILS VIEW --- */
  .details-view {
    background: #f1f5f9;
    padding: 24px;
    justify-content: center;
  }

  .details-card {
    background: white;
    border-radius: 24px;
    padding: 40px 32px;
    text-align: center;
    box-shadow: 0 10px 25px rgba(0, 0, 0, 0.06);
  }

  .icon-check-pulse {
    width: 72px;
    height: 72px;
    background: linear-gradient(135deg, #22c55e, #16a34a);
    border-radius: 50%;
    margin: 0 auto 24px;
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 0 0 8px rgba(34, 197, 94, 0.15);
  }

  .detail-row {
    display: flex;
    justify-content: space-between;
    padding: 16px 0;
    border-bottom: 1px dashed #e2e8f0;
  }
  .detail-row:last-of-type {
    margin-bottom: 32px;
    border-bottom: none;
  }

  .btn-primary {
    width: 100%;
    padding: 16px;
    background: #0f172a;
    color: white;
    border: none;
    border-radius: 12px;
    font-weight: 600;
    font-size: 16px;
    margin-bottom: 12px;
  }
  .btn-secondary {
    width: 100%;
    padding: 16px;
    background: #f1f5f9;
    color: #475569;
    border: none;
    border-radius: 12px;
    font-weight: 600;
    font-size: 16px;
  }
</style>
