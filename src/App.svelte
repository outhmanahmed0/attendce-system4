<script>
  let token = "";
  let view = "welcome"; // Start at welcome screen
  let scannedCode = "";
  let garageName = "";
  let parkingTime = "";

  // New State variables
  let manualName = "";
  let showManualInput = false;

  // Dummy History Data (Init with some data, but we will append real ones)
  let history = [
    {
      id: 101,
      location: "Central Garage",
      time: "Yesterday, 09:00 AM",
      status: "Present",
    },
    {
      id: 102,
      location: "North Campus",
      time: "Yesterday, 08:30 AM",
      status: "Late",
    },
  ];

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
    // 8:00 (8) to 15:00 (3 PM)
    if (hours >= 8 && hours < 15) {
      return "Present";
    }
    return "Late";
  }

  // --- STRICT REQUIRED FUNCTIONS (DO NOT MODIFY LOGIC, BUT ADDING UI FEEDBACK IS OK) ---
  function authenticate() {
    return new Promise((resolve, reject) => {
      my.getAuthCode({
        scopes: ["auth_base", "USER_ID"],
        success: (res) => {
          const authCode = res.authCode;
          // my.alert({ content: 'Got auth code: ' + authCode }); // Optional debug

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
                my.alert({ content: "Scan successful: Code " + scannedCode }); // Added feedback

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
                    parkingTime = data.parkingTime || "1 hour"; // API doesn't give time status, assume present or use logic?
                    // Let's also log this scan to history
                    addToHistory("Scanned: " + garageName);
                    view = "details";
                  })
                  .catch(() => {
                    garageName = "Garage " + scannedCode;
                    parkingTime = "1 hour";
                    addToHistory("Scanned: " + garageName);
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
  // --- END ---

  // Navigation & Logic
  function enterApp() {
    view = "main";
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
    history = [newRecord, ...history];
    return newRecord;
  }

  function submitManualAttendance() {
    if (!manualName.trim()) {
      my.alert({ content: "Please enter your name." });
      return;
    }

    // Add to history log
    const record = addToHistory("Manual: " + manualName);

    // Show confirmation
    my.alert({
      content: `Attendance registered for ${manualName}\nStatus: ${record.status}`,
    });

    // Update Details view variables
    garageName = "User: " + manualName;
    parkingTime = record.time;

    view = "details";
    manualName = "";
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
        <p class="subtitle">Seamless tracking for a smarter workplace.</p>
        <button class="btn-primary-large" on:click={enterApp}
          >Get Started</button
        >
      </div>
    </div>

    <!-- MAIN REGISTRATION VIEW -->
  {:else if view === "main"}
    <div class="view main-view">
      <header class="top-nav">
        <h1>Registration</h1>
        <button class="icon-btn" on:click={goToHistory} title="History">
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
            ><path d="M12 8v4l3 3"></path><circle cx="12" cy="12" r="10"
            ></circle></svg
          >
        </button>
      </header>

      <div class="content-center">
        <div class="scan-wrapper">
          <div class="scanner-frame">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="60"
              height="60"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#fff"
              stroke-width="1.5"
              stroke-linecap="round"
              stroke-linejoin="round"
              ><rect x="3" y="3" width="18" height="18" rx="2" ry="2"
              ></rect><line x1="12" y1="8" x2="12" y2="16"></line><line
                x1="8"
                y1="12"
                x2="16"
                y2="12"
              ></line></svg
            >
          </div>
          <button class="btn-scan-main" on:click={scan}>Scan Attendance</button>
        </div>

        <div class="divider">
          <span>OR</span>
        </div>

        <div class="manual-entry-section">
          {#if !showManualInput}
            <button class="btn-text-action" on:click={toggleManualInput}
              >Register by Name</button
            >
          {:else}
            <div class="input-group slide-down">
              <input
                type="text"
                placeholder="Enter your name"
                bind:value={manualName}
                class="input-modern"
              />
              <button class="btn-confirm" on:click={submitManualAttendance}>
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
                  ><polyline points="20 6 9 17 4 12"></polyline></svg
                >
              </button>
              <button class="btn-close" on:click={toggleManualInput}
                >&times;</button
              >
            </div>
          {/if}
        </div>
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
        <h1>Records</h1>
        <div style="width: 24px;"></div>
        <!-- Spacer -->
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
                <!-- Pay Fine Button with Special Yellow Active State -->
                <button class="btn-pay-fine" on:click={pay}>Pay Fine</button>
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
          <span class="label">Location / Name</span>
          <span class="value">{garageName}</span>
        </div>
        <div class="detail-row">
          <span class="label">Time</span>
          <span class="value">{parkingTime}</span>
        </div>

        <button class="btn-primary" on:click={backToMain}>Back to Home</button>
        <button class="btn-secondary" on:click={pay}
          >Pay Fine (If Applicable)</button
        >
      </div>
    </div>
  {/if}
</main>

<style>
  /* --- GLOBAL VARIABLES & FONTS --- */
  @import url("https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap");

  :global(body) {
    margin: 0;
    font-family: "Inter", sans-serif;
    background-color: #f8fafc; /* Very light blue-grey */
    color: #1e293b; /* Slate 800 */
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

  /* --- HEADER SHARED --- */
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

  .scan-wrapper {
    position: relative;
    width: 100%;
    max-width: 280px;
    aspect-ratio: 1;
    background: linear-gradient(135deg, #2563eb, #4f46e5);
    border-radius: 32px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    box-shadow: 0 20px 40px rgba(37, 99, 235, 0.3);
    overflow: hidden;
  }

  .scanner-frame {
    margin-bottom: 16px;
    opacity: 0.9;
  }

  .btn-scan-main {
    background: rgba(255, 255, 255, 0.2);
    border: 1px solid rgba(255, 255, 255, 0.3);
    color: white;
    padding: 12px 24px;
    border-radius: 50px;
    font-size: 16px;
    font-weight: 600;
    backdrop-filter: blur(5px);
    cursor: pointer;
  }
  .btn-scan-main:active {
    background: rgba(255, 255, 255, 0.3);
  }

  .divider {
    margin: 32px 0;
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
    background: #ffffff; /* Match container bg */
    padding: 0 12px;
    color: #94a3b8;
    font-size: 14px;
    font-weight: 500;
  }

  .btn-text-action {
    color: #3b82f6;
    background: none;
    border: none;
    font-size: 16px;
    font-weight: 600;
    cursor: pointer;
  }

  .input-group {
    display: flex;
    width: 100%;
    gap: 8px;
  }

  .input-modern {
    flex: 1;
    padding: 12px 16px;
    border-radius: 12px;
    border: 1px solid #e2e8f0;
    background: #f8fafc;
    font-size: 16px;
    outline: none;
    transition: border-color 0.2s;
  }
  .input-modern:focus {
    border-color: #3b82f6;
  }

  .btn-confirm {
    background: #0f172a;
    color: white;
    border: none;
    border-radius: 12px;
    width: 48px;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
  }

  .btn-close {
    background: none;
    border: none;
    color: #94a3b8;
    font-size: 24px;
    cursor: pointer;
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

  /* Yellow Active State for Pay Fine */
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
    background-color: #fef08a; /* Soft Yellow */
    border-color: #eab308; /* Darker Yellow Border */
    color: #854d0e; /* Dark Yellow/Brown Text */
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
