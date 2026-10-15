# 000 – Pulse product overview

## Vision
A small campaign and coupon engine for learning backend architecture: schedule messages to user segments, let users redeem limited coupons, and track clicks and redemptions live.

## Glossary
- **User**: someone who can receive messages and redeem coupons.
- **Segment**: a named group of users.
- **Campaign**: a message sent to one segment through one channel at a scheduled time.
- **Channel**: how a message is delivered (fake LINE, email, webhook).
- **Coupon**: a code with limited stock, attached to a campaign. One redemption per user.
- **Event**: an immutable record of something that happened (`CampaignScheduled`, `MessageSent`, `LinkClicked`, `CouponRedeemed`).

## Learning goals
SOLID, Fastify, BullMQ jobs and queues, Redis (cache, atomic ops, streams), Postgres and indexing, event-driven architecture (outbox), SolidJS 2, spec-driven development with Claude.

## Spec index
| # | Spec | Phase | Status |
|---|---|---|---|
| 001 | [campaign-crud](001-campaign-crud/spec.md) | 1 | planned |
| 002 | segments | 1 | |
| 003 | coupon-redeem | 2 | |
| 004 | campaign-cache | 2 | |
| 005 | broadcast-fanout | 3 | |
| 006 | dlq-and-retries | 3 | |
| 007 | outbox-relay | 4 | |
| 008 | stats-consumer | 4 | |
| 009 | dashboard-campaigns | 5 | |
| 010 | dashboard-live-stats | 5 | |
| 011 | indexing-lab | 6 | |
