/**
 * src/services/salesforce.js
 * Singleton jsforce connection. Logs in once and reuses the session.
 */

const jsforce = require("jsforce");

let conn = null;

async function getConnection() {
  if (conn && conn.accessToken) return conn;

  conn = new jsforce.Connection({
    loginUrl: process.env.SF_LOGIN_URL || "https://login.salesforce.com",
  });

  await conn.login(
    process.env.SF_USERNAME,
    process.env.SF_PASSWORD + process.env.SF_SECURITY_TOKEN
  );

  console.log("[SF] Authenticated. Instance:", conn.instanceUrl);
  return conn;
}

// ── Find latest open Case by requester email ──────────────────────
// This is the key function for the auto-lookup feature.
// Looks up Contact by email first, then finds their most recent open Case.
async function getCaseByEmail(email) {
  const sf = await getConnection();

  // First find the Contact by email
  const contactResult = await sf.query(
    `SELECT Id, AccountId FROM Contact WHERE Email = '${email}' LIMIT 1`
  );

  if (!contactResult.records.length) {
    // No Contact found — try searching Cases directly by contact email
    const caseByEmail = await sf.query(
      `SELECT Id, CaseNumber, Subject, Status, Priority, Origin,
              CreatedDate, AccountId, ContactId,
              Account.Name, Account.Type, Account.AnnualRevenue,
              Contact.Name, Contact.Title, Contact.Email, Contact.Phone
       FROM Case
       WHERE Contact.Email = '${email}'
       AND IsClosed = false
       ORDER BY CreatedDate DESC
       LIMIT 1`
    );

    return caseByEmail.records[0] || null;
  }

  const contactId = contactResult.records[0].Id;

  // Find their most recent open Case
  const caseResult = await sf.query(
    `SELECT Id, CaseNumber, Subject, Status, Priority, Origin,
            CreatedDate, AccountId, ContactId,
            Account.Name, Account.Type, Account.AnnualRevenue,
            Contact.Name, Contact.Title, Contact.Email, Contact.Phone
     FROM Case
     WHERE ContactId = '${contactId}'
     AND IsClosed = false
     ORDER BY CreatedDate DESC
     LIMIT 1`
  );

  // If no open case, fall back to most recent case (any status)
  if (!caseResult.records.length) {
    const anyCase = await sf.query(
      `SELECT Id, CaseNumber, Subject, Status, Priority, Origin,
              CreatedDate, AccountId, ContactId,
              Account.Name, Account.Type, Account.AnnualRevenue,
              Contact.Name, Contact.Title, Contact.Email, Contact.Phone
       FROM Case
       WHERE ContactId = '${contactId}'
       ORDER BY CreatedDate DESC
       LIMIT 1`
    );
    return anyCase.records[0] || null;
  }

  return caseResult.records[0];
}

// ── Get Case by ID ────────────────────────────────────────────────
async function getCase(sfCaseId) {
  const sf = await getConnection();

  const result = await sf.query(
    `SELECT Id, CaseNumber, Subject, Status, Priority, Origin,
            CreatedDate, AccountId, ContactId,
            Account.Name, Account.Type, Account.AnnualRevenue,
            Contact.Name, Contact.Title, Contact.Email, Contact.Phone
     FROM Case
     WHERE Id = '${sfCaseId}'
     LIMIT 1`
  );

  if (!result.records.length) {
    throw new Error("Salesforce Case not found: " + sfCaseId);
  }

  return result.records[0];
}

// ── Case Activity / History ───────────────────────────────────────
async function getCaseActivity(sfCaseId) {
  const sf = await getConnection();

  const result = await sf.query(
    `SELECT Field, NewValue, CreatedDate, CreatedBy.Name
     FROM CaseHistory
     WHERE CaseId = '${sfCaseId}'
     ORDER BY CreatedDate DESC
     LIMIT 10`
  );

  return result.records.map((r) => ({
    label: formatHistoryLabel(r),
    date:  r.CreatedDate,
  }));
}

function formatHistoryLabel(record) {
  const field = record.Field;
  const by    = record.CreatedBy && record.CreatedBy.Name ? record.CreatedBy.Name : "System";
  if (field === "created")  return "Case created";
  if (field === "Status")   return "Status changed to " + record.NewValue + " by " + by;
  if (field === "Priority") return "Priority set to " + record.NewValue + " by " + by;
  return field + " updated by " + by;
}

// ── Account / Contact ─────────────────────────────────────────────
async function getAccount(sfAccountId) {
  const sf = await getConnection();
  return sf.sobject("Account").retrieve(sfAccountId);
}

async function getContact(sfContactId) {
  const sf = await getConnection();
  return sf.sobject("Contact").retrieve(sfContactId);
}

module.exports = { getCaseByEmail, getCase, getCaseActivity, getAccount, getContact };
