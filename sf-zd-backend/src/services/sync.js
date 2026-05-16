/**
 * src/services/sync.js
 * Orchestrates the three sync flows.
 * Each function is idempotent — safe to call multiple times.
 */

const sf   = require("./salesforce");
const zd   = require("./zendesk");
const maps = require("../db/mappings");

// ── 1. Account → Organization ─────────────────────────────────────

async function syncAccount(sfAccountId) {
  const existing = maps.accountOrg.findBySfId(sfAccountId);
  if (existing) return existing;

  const account = await sf.getAccount(sfAccountId);
  let org = await zd.findOrgByName(account.Name);

  if (org) {
    await zd.updateOrg(org.id, { external_id: sfAccountId });
  } else {
    org = await zd.createOrg(account.Name, sfAccountId, {
      sf_account_type: account.Type || "",
    });
  }

  maps.accountOrg.upsert(sfAccountId, org.id, account.Name);
  maps.syncLog.write("account_sync", sfAccountId, String(org.id), "ok");

  return maps.accountOrg.findBySfId(sfAccountId);
}

// ── 2. Contact → User/Requester ───────────────────────────────────

async function syncContact(sfContactId) {
  const existing = maps.contactUser.findBySfId(sfContactId);
  if (existing) return existing;

  const contact = await sf.getContact(sfContactId);
  const email = contact.Email;

  if (!email) {
    throw new Error("Salesforce Contact " + sfContactId + " has no email address");
  }

  let zdOrgId = null;
  if (contact.AccountId) {
    const orgMap = await syncAccount(contact.AccountId);
    zdOrgId = orgMap.zd_org_id;
  }

  let user = await zd.findUserByEmail(email);

  if (user) {
    await zd.updateUser(user.id, {
      name:            contact.Name,
      external_id:     sfContactId,
      organization_id: zdOrgId,
    });
  } else {
    user = await zd.createUser(contact.Name, email, zdOrgId, sfContactId);
  }

  maps.contactUser.upsert(sfContactId, user.id, email, contact.AccountId);
  maps.syncLog.write("contact_sync", sfContactId, String(user.id), "ok");

  return maps.contactUser.findBySfId(sfContactId);
}

// ── 3. Case → Ticket ──────────────────────────────────────────────

async function syncCase(sfCaseId) {
  const existing = maps.caseTicket.findBySfId(sfCaseId);
  const sfCase   = await sf.getCase(sfCaseId);

  let zdOrgId       = null;
  let zdRequesterId = null;

  if (sfCase.AccountId) {
    const orgMap = await syncAccount(sfCase.AccountId);
    zdOrgId = orgMap.zd_org_id;
  }

  if (sfCase.ContactId) {
    const userMap = await syncContact(sfCase.ContactId);
    zdRequesterId = userMap.zd_user_id;
  }

  let zdTicket;

  if (existing && existing.zd_ticket_id) {
    zdTicket = await zd.updateTicket(existing.zd_ticket_id, {
      subject:         sfCase.Subject,
      priority:        mapPriority(sfCase.Priority),
      organization_id: zdOrgId,
    });
  } else {
    const found = await zd.findTicketBySfCaseId(sfCaseId);
    if (found) {
      zdTicket = found;
    } else {
      zdTicket = await zd.createTicket({
        subject:     sfCase.Subject,
        description: "Synced from Salesforce Case #" + sfCase.CaseNumber,
        requesterId: zdRequesterId,
        orgId:       zdOrgId,
        sfCaseId,
        priority:    sfCase.Priority,
      });
    }
  }

  maps.caseTicket.upsert(
    sfCaseId, sfCase.CaseNumber, zdTicket.id,
    sfCase.AccountId, sfCase.ContactId
  );
  maps.syncLog.write("case_sync", sfCaseId, String(zdTicket.id), "ok");

  return maps.caseTicket.findBySfId(sfCaseId);
}

// ── Sidebar payload ───────────────────────────────────────────────

async function buildCasePayload(sfCaseId) {
  const [sfCase, activity] = await Promise.all([
    sf.getCase(sfCaseId),
    sf.getCaseActivity(sfCaseId),
  ]);

  const account = sfCase.Account || {};
  const contact = sfCase.Contact || {};

  return {
    sfCase: {
      caseNumber:  sfCase.CaseNumber,
      subject:     sfCase.Subject,
      status:      sfCase.Status,
      priority:    sfCase.Priority,
      origin:      sfCase.Origin,
      createdDate: sfCase.CreatedDate,
      url:         buildSfCaseUrl(sfCaseId),
    },
    account: {
      name: account.Name,
      type: account.Type,
      plan: account.Type,
      arr:  account.AnnualRevenue,
      csm:  null,
    },
    contact: {
      name:  contact.Name,
      title: contact.Title,
      email: contact.Email,
      phone: contact.Phone,
    },
    activity,
  };
}

function mapPriority(sfPriority) {
  return { High: "high", Medium: "normal", Low: "low" }[sfPriority] || "normal";
}

function buildSfCaseUrl(sfCaseId) {
  const base = (process.env.SF_LOGIN_URL || "https://login.salesforce.com")
    .replace("login.salesforce.com", "lightning.force.com");
  return base + "/lightning/r/Case/" + sfCaseId + "/view";
}



// ── Build payload from an already-fetched SF Case object ──────────
// Used by the email-based lookup to avoid a second API call.
async function buildCasePayloadFromCase(sfCase) {
  const activity = await require("./salesforce").getCaseActivity(sfCase.Id);

  const account = sfCase.Account || {};
  const contact = sfCase.Contact || {};

  return {
    sfCase: {
      id:          sfCase.Id,
      caseNumber:  sfCase.CaseNumber,
      subject:     sfCase.Subject,
      status:      sfCase.Status,
      priority:    sfCase.Priority,
      origin:      sfCase.Origin,
      createdDate: sfCase.CreatedDate,
      url:         buildSfCaseUrl(sfCase.Id),
    },
    account: {
      name: account.Name,
      type: account.Type,
      plan: account.Type,
      arr:  account.AnnualRevenue,
      csm:  null,
    },
    contact: {
      name:  contact.Name,
      title: contact.Title,
      email: contact.Email,
      phone: contact.Phone,
    },
    activity,
  };
}

module.exports = { syncAccount, syncContact, syncCase, buildCasePayload, buildCasePayloadFromCase };
