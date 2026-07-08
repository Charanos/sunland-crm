import { relations } from "drizzle-orm";
import {
  activityLogs,
  approvalRequests,
  entities,
  notifications,
  permissions,
  roles,
  rolePermissions,
  sessions,
  settings,
  userRoles,
  users,
} from "@/db/schema/platform";
import { contacts, leads } from "@/db/schema/crm";
import { leases, maintenanceRequests, properties } from "@/db/schema/properties";
import { transactions } from "@/db/schema/finance";

export const entitiesRelations = relations(entities, ({ many }) => ({
  users: many(users),
  contacts: many(contacts),
  properties: many(properties),
  leads: many(leads),
  leases: many(leases),
  maintenanceRequests: many(maintenanceRequests),
  transactions: many(transactions),
  approvalRequests: many(approvalRequests),
  userRoles: many(userRoles),
  settings: many(settings),
}));

export const usersRelations = relations(users, ({ one, many }) => ({
  primaryEntity: one(entities, {
    fields: [users.primaryEntityId],
    references: [entities.id],
  }),
  userRoles: many(userRoles),
  sessions: many(sessions),
  assignedContacts: many(contacts),
  assignedLeads: many(leads),
  recordedTransactions: many(transactions),
  notifications: many(notifications),
}));

export const permissionsRelations = relations(permissions, ({ many }) => ({
  rolePermissions: many(rolePermissions),
}));

export const rolesRelations = relations(roles, ({ many }) => ({
  rolePermissions: many(rolePermissions),
  userRoles: many(userRoles),
}));

export const rolePermissionsRelations = relations(rolePermissions, ({ one }) => ({
  role: one(roles, {
    fields: [rolePermissions.roleId],
    references: [roles.id],
  }),
  permission: one(permissions, {
    fields: [rolePermissions.permissionId],
    references: [permissions.id],
  }),
}));

export const userRolesRelations = relations(userRoles, ({ one }) => ({
  user: one(users, {
    fields: [userRoles.userId],
    references: [users.id],
  }),
  role: one(roles, {
    fields: [userRoles.roleId],
    references: [roles.id],
  }),
  entity: one(entities, {
    fields: [userRoles.entityId],
    references: [entities.id],
  }),
}));

export const sessionsRelations = relations(sessions, ({ one }) => ({
  user: one(users, {
    fields: [sessions.userId],
    references: [users.id],
  }),
}));

export const settingsRelations = relations(settings, ({ one }) => ({
  entity: one(entities, {
    fields: [settings.entityId],
    references: [entities.id],
  }),
}));

export const contactsRelations = relations(contacts, ({ one, many }) => ({
  entity: one(entities, {
    fields: [contacts.entityId],
    references: [entities.id],
  }),
  assignedTo: one(users, {
    fields: [contacts.assignedToId],
    references: [users.id],
  }),
  ownedProperties: many(properties),
  leads: many(leads),
  tenantLeases: many(leases),
  transactions: many(transactions),
}));

export const propertiesRelations = relations(properties, ({ one, many }) => ({
  entity: one(entities, {
    fields: [properties.entityId],
    references: [entities.id],
  }),
  ownerContact: one(contacts, {
    fields: [properties.ownerContactId],
    references: [contacts.id],
  }),
  leads: many(leads),
  leases: many(leases),
  maintenanceRequests: many(maintenanceRequests),
  transactions: many(transactions),
}));

export const leadsRelations = relations(leads, ({ one }) => ({
  entity: one(entities, {
    fields: [leads.entityId],
    references: [entities.id],
  }),
  contact: one(contacts, {
    fields: [leads.contactId],
    references: [contacts.id],
  }),
  property: one(properties, {
    fields: [leads.propertyId],
    references: [properties.id],
  }),
  assignedTo: one(users, {
    fields: [leads.assignedToId],
    references: [users.id],
  }),
}));

export const leasesRelations = relations(leases, ({ one, many }) => ({
  entity: one(entities, {
    fields: [leases.entityId],
    references: [entities.id],
  }),
  property: one(properties, {
    fields: [leases.propertyId],
    references: [properties.id],
  }),
  tenantContact: one(contacts, {
    fields: [leases.tenantContactId],
    references: [contacts.id],
  }),
  transactions: many(transactions),
}));

export const maintenanceRequestsRelations = relations(maintenanceRequests, ({ one }) => ({
  entity: one(entities, {
    fields: [maintenanceRequests.entityId],
    references: [entities.id],
  }),
  property: one(properties, {
    fields: [maintenanceRequests.propertyId],
    references: [properties.id],
  }),
  reportedByContact: one(contacts, {
    fields: [maintenanceRequests.reportedByContactId],
    references: [contacts.id],
  }),
  assignedContractor: one(contacts, {
    fields: [maintenanceRequests.assignedContractorId],
    references: [contacts.id],
  }),
}));

export const transactionsRelations = relations(transactions, ({ one }) => ({
  entity: one(entities, {
    fields: [transactions.entityId],
    references: [entities.id],
  }),
  contact: one(contacts, {
    fields: [transactions.contactId],
    references: [contacts.id],
  }),
  property: one(properties, {
    fields: [transactions.propertyId],
    references: [properties.id],
  }),
  lease: one(leases, {
    fields: [transactions.leaseId],
    references: [leases.id],
  }),
  recordedBy: one(users, {
    fields: [transactions.recordedById],
    references: [users.id],
  }),
}));

export const approvalRequestsRelations = relations(approvalRequests, ({ one }) => ({
  entity: one(entities, {
    fields: [approvalRequests.entityId],
    references: [entities.id],
  }),
  requestedBy: one(users, {
    fields: [approvalRequests.requestedById],
    references: [users.id],
  }),
  decidedBy: one(users, {
    fields: [approvalRequests.decidedById],
    references: [users.id],
  }),
}));

export const notificationsRelations = relations(notifications, ({ one }) => ({
  entity: one(entities, {
    fields: [notifications.entityId],
    references: [entities.id],
  }),
  user: one(users, {
    fields: [notifications.userId],
    references: [users.id],
  }),
}));

export const activityLogsRelations = relations(activityLogs, ({ one }) => ({
  entity: one(entities, {
    fields: [activityLogs.entityId],
    references: [entities.id],
  }),
  actor: one(users, {
    fields: [activityLogs.actorId],
    references: [users.id],
  }),
}));
