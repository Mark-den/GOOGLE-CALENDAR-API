// Google OAuth client ID used to identify the application
const CLIENT_ID = "182932293888-a531fdsnb8h76kd2abva1i90fmuj7cc2.apps.googleusercontent.com";

// Permission scope allowing access to Google Calendar
const SCOPES = "https://www.googleapis.com/auth/calendar";

// OAuth token handler and access token storage
let tokenClient;
let accessToken = null;


// Displays error messages to the user
function showError(message) {
  const errorDiv = document.getElementById("error");
  errorDiv.textContent = message;
  errorDiv.style.display = "block";
}


function hideError() {
  document.getElementById("error").style.display = "none";
}

// Displays success feedback temporarily
function showSuccess(message) {
  const s = document.getElementById("success");
  s.textContent = message;
  s.style.display = "block";
  setTimeout(() => { s.style.display = "none"; }, 4000);
}

// Shows or hides loading indicator
function showLoading(show) {
  document.getElementById("loading").style.display = show ? "block" : "none";
}


function formatDateTime(dateString) {
  if (!dateString) return "No time";
  const date = new Date(dateString);
  return date.toLocaleString();
}



// Retrieves stored event IDs created by this app
function getCreatedEventIds() {
  try {
    const raw = localStorage.getItem('createdEventIds');
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}

// Saves newly created event ID
function saveCreatedEventId(id) {
  if (!id) return;
  const ids = getCreatedEventIds();
  if (!ids.includes(id)) {
    ids.push(id);
    localStorage.setItem('createdEventIds', JSON.stringify(ids));
  }
}

// Removes deleted event ID from storage
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


// Initializes Google OAuth when page loads
window.onload = () => {
  try {
    tokenClient = google.accounts.oauth2.initTokenClient({
      client_id: CLIENT_ID,
      scope: SCOPES,
      callback: (tokenResponse) => {
        // Store access token after successful login
        if (tokenResponse.access_token) {
          accessToken = tokenResponse.access_token;

          // DOM manipulation: update UI after login
          document.getElementById("authSection").style.display = "none";
          document.getElementById("loadSection").style.display = "block";
          document.getElementById("createSection").style.display = "block";
          document.getElementById("logoutBtn").style.display = "block";

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

// Triggers Google sign-in process
document.getElementById("loginBtn").onclick = () => {
  tokenClient.requestAccessToken();
};


document.getElementById("logoutBtn").onclick = () => {
  accessToken = null;

  // DOM reset to logged-out state
  document.getElementById("authSection").style.display = "block";
  document.getElementById("loadSection").style.display = "none";
  document.getElementById("createSection").style.display = "none";
  document.getElementById("logoutBtn").style.display = "none";
  document.getElementById("events").innerHTML = "";

  const container = document.querySelector('.container');
  if (container) container.classList.remove('signed-in');

  hideError();
};


// Load events button handler
document.getElementById("loadEventsBtn").onclick = () => loadEvents();

function loadEvents() {
  if (!accessToken) {
    showError("No access token. Please login again.");
    return;
  }

  showLoading(true);
  hideError();

  // Google Calendar API GET request
  fetch("https://www.googleapis.com/calendar/v3/calendars/primary/events", {
    headers: {
      Authorization: `Bearer ${accessToken}` // API authentication
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

    // Handle empty calendar
    if (!data.items || data.items.length === 0) {
      const li = document.createElement("li");
      li.textContent = "No events found";
      li.className = "no-events";
      eventsList.appendChild(li);
      return;
    }

    // Dynamically display events in the DOM
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



// Create event button handler
document.getElementById("createEventBtn").onclick = async () => {
  if (!accessToken) {
    showError("No access token. Please login.");
    return;
  }

  // Read form values from DOM
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

  // Validate event duration
  if (new Date(startISO) >= new Date(endISO)) {
    showError("End time must be after start time.");
    return;
  }

  showLoading(true);
  hideError();

  // Event object sent to Google Calendar API
  const event = {
    summary: title,
    description: desc || undefined,
    start: { dateTime: startISO },
    end: { dateTime: endISO }
  };

  try {
    // Google Calendar API POST request
    const res = await fetch(
      "https://www.googleapis.com/calendar/v3/calendars/primary/events",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(event)
      }
    );

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Create failed: ${res.status} ${errText}`);
    }

    await res.json();
    showLoading(false);

    // Reset form and reload events
    document.getElementById("createEventForm").reset();
    loadEvents();
    showSuccess("Event created — it will appear in your Google Calendar.");
  } catch (err) {
    showLoading(false);
    showError("Error creating event: " + err.message);
  }
};

// Clears event form inputs
document.getElementById("clearFormBtn").onclick = () => {
  document.getElementById("createEventForm").reset();
};


// Deletes an event from Google Calendar
async function deleteEvent(eventId, listItem) {
  if (!accessToken) {
    showError('Not authenticated. Please sign in.');
    return;
  }

  showLoading(true);
  hideError();

  try {
    // Google Calendar API DELETE request
    const res = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/primary/events/${encodeURIComponent(eventId)}`,
      {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${accessToken}` }
      }
    );

    if (res.status === 204 || res.ok) {
      // Update local storage and UI
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
