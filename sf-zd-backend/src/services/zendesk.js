/**
 * src/services/zendesk.js
 * Thin wrappers around the Zendesk REST API using node-zendesk.
 */

const zendesk = require("node-zendesk");

let client = null;

function getClient() {
  if (client) return client;
  client = zendesk.createClient({
    username:  process.env.ZD_EMAIL,
    token:     process.env.ZD_API_TOKEN,
    remoteUri: "https://" + process.env.ZD_SUBDOMAIN + ".zendesk.com/api/v2",
  });
  return client;
}

// ── Organizations ─────────────────────────────────────────────────
async function findOrgByName(name) {
  const zd = getClient();
  const results = await zd.organizations.search({ query: name });
  return results.find((o) => o.name.toLowerCase() === name.toLowerCase()) || null;
}

async function createOrg(name, externalId, metadata) {
  const zd = getClient();
  return zd.organizations.create({
    organization: { name, external_id: externalId, organization_fields: metadata || {} },
  });
}

async function updateOrg(zdOrgId, fields) {
  const zd = getClient();
  return zd.organizations.update(zdOrgId, { organization: fields });
}

// ── Users ─────────────────────────────────────────────────────────
async function findUserByEmail(email) {
  const zd = getClient();
  const results = await zd.users.search({ query: "email:" + email });
  return results[0] || null;
}

async function createUser(name, email, zdOrgId, externalId) {
  const zd = getClient();
  return zd.users.create({
    user: { name, email, external_id: externalId, organization_id: zdOrgId, role: "end-user" },
  });
}

async function updateUser(zdUserId, fields) {
  const zd = getClient();
  return zd.users.update(zdUserId, { user: fields });
}

// ── Tickets ───────────────────────────────────────────────────────
function sfFieldId() { return process.env.ZD_SF_CASE_FIELD_ID; }

async function findTicketBySfCaseId(sfCaseId) {
  const zd = getClient();
  const results = await zd.search.query(
    "type:ticket custom_field_" + sfFieldId() + ":" + sfCaseId
  );
  return results[0] || null;
}

async function createTicket(opts) {
  const zd = getClient();
  return zd.tickets.create({
    ticket: {
      subject:         opts.subject,
      comment:         { body: opts.description },
      requester_id:    opts.requesterId,
      organization_id: opts.orgId,
      priority:        (opts.priority || "normal").toLowerCase(),
      custom_fields:   [{ id: sfFieldId(), value: opts.sfCaseId }],
    },
  });
}

async function updateTicket(zdTicketId, fields) {
  const zd = getClient();
  return zd.tickets.update(zdTicketId, { ticket: fields });
}

async function getTicket(zdTicketId) {
  const zd = getClient();
  return zd.tickets.show(zdTicketId);
}

module.exports = {
  findOrgByName, createOrg, updateOrg,
  findUserByEmail, createUser, updateUser,
  findTicketBySfCaseId, createTicket, updateTicket, getTicket,
};
