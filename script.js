const CLIENT_ID = "182932293888-a531fdsnb8h76kd2abva1i90fmuj7cc2.apps.googleusercontent.com";
const SCOPES = "https://www.googleapis.com/auth/calendar";

let tokenClient;
let accessToken = null;

function showError(message) {
  const errorDiv = document.getElementById("error");
  errorDiv.textContent = message;
  errorDiv.style.display = "block";
}

function hideError() {
  document.getElementById("error").style.display = "none";
}

function showSuccess(message) {
  const s = document.getElementById("success");
  s.textContent = message;
  s.style.display = "block";
  setTimeout(() => { s.style.display = "none"; }, 4000);
}

function showLoading(show) {
  document.getElementById("loading").style.display = show ? "block" : "none";
}

function formatDateTime(dateString) {
  if (!dateString) return "No time";
  const date = new Date(dateString);
  return date.toLocaleString();
}

// Helpers to track events created by this app
function getCreatedEventIds() {
  try {
    const raw = localStorage.getItem('createdEventIds');
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}

function saveCreatedEventId(id) {
  if (!id) return;
  const ids = getCreatedEventIds();
  if (!ids.includes(id)) {
    ids.push(id);
    localStorage.setItem('createdEventIds', JSON.stringify(ids));
  }
}

function removeCreatedEventId(id) {
  if (!id) return;
  const ids = getCreatedEventIds();
  const idx = ids.indexOf(id);
  if (idx !== -1) {
    ids.splice(idx, 1);
    localStorage.setItem('createdEventIds', JSON.stringify(ids));
  }
}

function isCreatedEvent(id) {
  if (!id) return false;
  const ids = getCreatedEventIds();
  return ids.includes(id);
}

window.onload = () => {
  try {
    tokenClient = google.accounts.oauth2.initTokenClient({
      client_id: CLIENT_ID,
      scope: SCOPES,
      callback: (tokenResponse) => {
        if (tokenResponse.access_token) {
          accessToken = tokenResponse.access_token;
          document.getElementById("authSection").style.display = "none";
          document.getElementById("loadSection").style.display = "block";
            document.getElementById("createSection").style.display = "block";
            document.getElementById("logoutBtn").style.display = "block";
            // add class to container so we can reserve space for the logout button
            const container = document.querySelector('.container');
            if (container) container.classList.add('signed-in');
          hideError();
        }
      }
    });
  } catch (error) {
    showError("Failed to initialize Google Sign-In: " + error.message);
  }
};

document.getElementById("loginBtn").onclick = () => {
  try {
    tokenClient.requestAccessToken();
  } catch (error) {
    showError("Login failed: " + error.message);
  }
};

document.getElementById("logoutBtn").onclick = () => {
  accessToken = null;
  document.getElementById("authSection").style.display = "block";
  document.getElementById("loadSection").style.display = "none";
  document.getElementById("createSection").style.display = "none";
  document.getElementById("logoutBtn").style.display = "none";
  document.getElementById("events").innerHTML = "";
  const container = document.querySelector('.container');
  if (container) container.classList.remove('signed-in');
  hideError();
};

document.getElementById("loadEventsBtn").onclick = () => loadEvents();

function loadEvents() {
  if (!accessToken) {
    showError("No access token. Please login again.");
    return;
  }

  showLoading(true);
  hideError();

  fetch("https://www.googleapis.com/calendar/v3/calendars/primary/events", {
    headers: {
      Authorization: `Bearer ${accessToken}`
    }
  })
  .then(res => {
    if (!res.ok) {
      throw new Error(`HTTP error! status: ${res.status}`);
    }
    return res.json();
  })
  .then(data => {
    showLoading(false);
    const eventsList = document.getElementById("events");
    eventsList.innerHTML = "";

    if (!data.items || data.items.length === 0) {
      const li = document.createElement("li");
      li.textContent = "No events found";
      li.className = "no-events";
      eventsList.appendChild(li);
      return;
    }

    data.items.forEach(event => {
      const li = document.createElement("li");
      const title = event.summary || "No Title";
      const startTime = formatDateTime(event.start?.dateTime || event.start?.date);
      li.innerHTML = `<strong>${title}</strong><br><small>${startTime}</small>`;
      eventsList.appendChild(li);
    });
  })
  .catch(error => {
    showLoading(false);
    showError("Error loading events: " + error.message);
  });
}

// Create event handlers
document.getElementById("createEventBtn").onclick = async () => {
  if (!accessToken) {
    showError("No access token. Please login.");
    return;
  }

  const title = document.getElementById("eventTitle").value.trim();
  const desc = document.getElementById("eventDesc").value.trim();
  const startVal = document.getElementById("eventStart").value;
  const endVal = document.getElementById("eventEnd").value;

  if (!title || !startVal || !endVal) {
    showError("Please fill title, start and end times.");
    return;
  }

  const startISO = new Date(startVal).toISOString();
  const endISO = new Date(endVal).toISOString();

  if (new Date(startISO) >= new Date(endISO)) {
    showError("End time must be after start time.");
    return;
  }

  showLoading(true);
  hideError();

  const event = {
    summary: title,
    description: desc || undefined,
    start: { dateTime: startISO },
    end: { dateTime: endISO }
  };

  try {
    const res = await fetch("https://www.googleapis.com/calendar/v3/calendars/primary/events", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(event)
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Create failed: ${res.status} ${errText}`);
    }

    const created = await res.json();
    showLoading(false);
    // clear form and refresh events
    document.getElementById("createEventForm").reset();
    loadEvents();
    showSuccess("Event created — it will appear in your Google Calendar.");
  } catch (err) {
    showLoading(false);
    showError("Error creating event: " + err.message);
  }
};

document.getElementById("clearFormBtn").onclick = () => {
  document.getElementById("createEventForm").reset();
};

// Delete event by id
async function deleteEvent(eventId, listItem) {
  if (!accessToken) {
    showError('Not authenticated. Please sign in.');
    return;
  }
  showLoading(true);
  hideError();
  try {
    const res = await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events/${encodeURIComponent(eventId)}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    if (res.status === 204 || res.ok) {
      // removed
      removeCreatedEventId(eventId);
      if (listItem && listItem.parentElement) listItem.remove();
      showLoading(false);
      showSuccess('Event deleted');
    } else {
      const text = await res.text();
      throw new Error(`${res.status} ${text}`);
    }
  } catch (err) {
    showLoading(false);
    showError('Error deleting event: ' + err.message);
  }
}
