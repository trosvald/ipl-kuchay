create extension if not exists "pgcrypto";
create extension if not exists "uuid-ossp";
create extension if not exists "pg_net";
create extension if not exists "pg_cron";
create extension if not exists "btree_gist";

create type public.app_role as enum ('resident', 'treasurer', 'admin', 'super_admin');
create type public.billing_period_status as enum ('draft', 'open', 'closed', 'archived');
create type public.invoice_status as enum ('unpaid', 'pending_verification', 'partial', 'paid', 'rejected', 'waived', 'cancelled', 'overdue');
create type public.submission_status as enum ('submitted', 'verified', 'rejected', 'cancelled');
create type public.gateway_status as enum ('created', 'pending', 'settlement', 'capture', 'deny', 'cancel', 'expire', 'failure', 'refund', 'unknown');
create type public.notification_channel as enum ('telegram');
create type public.notification_status as enum ('queued', 'sent', 'failed', 'skipped');
create type public.report_type as enum ('monthly_summary', 'receipt', 'arrears', 'kavling_history');
create type public.import_status as enum ('draft', 'validated', 'applied', 'failed', 'cancelled');
