--
-- PostgreSQL database dump
--

\restrict glmdIf8QTC5k1rXJKYD6Y962Jf8iCxS0A6EMffG8zB5O7baArfHdqrPjeSNKhPc

-- Dumped from database version 14.20 (Ubuntu 14.20-0ubuntu0.22.04.1)
-- Dumped by pg_dump version 14.20 (Ubuntu 14.20-0ubuntu0.22.04.1)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: AppType; Type: TYPE; Schema: public; Owner: kiosk_user
--

CREATE TYPE public."AppType" AS ENUM (
    'EDITOR',
    'PLAYER'
);


ALTER TYPE public."AppType" OWNER TO kiosk_user;

--
-- Name: DeviceStatus; Type: TYPE; Schema: public; Owner: kiosk_user
--

CREATE TYPE public."DeviceStatus" AS ENUM (
    'ACTIVE',
    'DEACTIVATED'
);


ALTER TYPE public."DeviceStatus" OWNER TO kiosk_user;

--
-- Name: LicenseStatus; Type: TYPE; Schema: public; Owner: kiosk_user
--

CREATE TYPE public."LicenseStatus" AS ENUM (
    'ACTIVE',
    'SUSPENDED',
    'EXPIRED',
    'CANCELLED'
);


ALTER TYPE public."LicenseStatus" OWNER TO kiosk_user;

--
-- Name: Plan; Type: TYPE; Schema: public; Owner: kiosk_user
--

CREATE TYPE public."Plan" AS ENUM (
    'BASIC',
    'PRO',
    'MAX'
);


ALTER TYPE public."Plan" OWNER TO kiosk_user;

--
-- Name: UserRole; Type: TYPE; Schema: public; Owner: kiosk_user
--

CREATE TYPE public."UserRole" AS ENUM (
    'ADMIN',
    'USER'
);


ALTER TYPE public."UserRole" OWNER TO kiosk_user;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: _prisma_migrations; Type: TABLE; Schema: public; Owner: kiosk_user
--

CREATE TABLE public._prisma_migrations (
    id character varying(36) NOT NULL,
    checksum character varying(64) NOT NULL,
    finished_at timestamp with time zone,
    migration_name character varying(255) NOT NULL,
    logs text,
    rolled_back_at timestamp with time zone,
    started_at timestamp with time zone DEFAULT now() NOT NULL,
    applied_steps_count integer DEFAULT 0 NOT NULL
);


ALTER TABLE public._prisma_migrations OWNER TO kiosk_user;

--
-- Name: audit_logs; Type: TABLE; Schema: public; Owner: kiosk_user
--

CREATE TABLE public.audit_logs (
    id text NOT NULL,
    action text NOT NULL,
    "userId" text,
    "deviceId" text,
    "licenseId" text,
    details jsonb,
    "ipAddress" text,
    "userAgent" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.audit_logs OWNER TO kiosk_user;

--
-- Name: devices; Type: TABLE; Schema: public; Owner: kiosk_user
--

CREATE TABLE public.devices (
    id text NOT NULL,
    "deviceId" text NOT NULL,
    "licenseId" text NOT NULL,
    "appType" public."AppType" NOT NULL,
    "deviceName" text NOT NULL,
    "osInfo" text NOT NULL,
    status public."DeviceStatus" DEFAULT 'ACTIVE'::public."DeviceStatus" NOT NULL,
    "activatedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "deactivatedAt" timestamp(3) without time zone,
    "lastSeenAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public.devices OWNER TO kiosk_user;

--
-- Name: licenses; Type: TABLE; Schema: public; Owner: kiosk_user
--

CREATE TABLE public.licenses (
    id text NOT NULL,
    "licenseKey" text NOT NULL,
    "organizationId" text NOT NULL,
    plan public."Plan" NOT NULL,
    status public."LicenseStatus" DEFAULT 'ACTIVE'::public."LicenseStatus" NOT NULL,
    "seatsEditor" integer NOT NULL,
    "seatsPlayer" integer NOT NULL,
    "validFrom" timestamp(3) without time zone NOT NULL,
    "validUntil" timestamp(3) without time zone NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public.licenses OWNER TO kiosk_user;

--
-- Name: organizations; Type: TABLE; Schema: public; Owner: kiosk_user
--

CREATE TABLE public.organizations (
    id text NOT NULL,
    name text NOT NULL,
    "ownerUserId" text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public.organizations OWNER TO kiosk_user;

--
-- Name: tokens; Type: TABLE; Schema: public; Owner: kiosk_user
--

CREATE TABLE public.tokens (
    id text NOT NULL,
    "deviceId" text NOT NULL,
    jti text NOT NULL,
    "tokenHash" text NOT NULL,
    "expiresAt" timestamp(3) without time zone NOT NULL,
    revoked boolean DEFAULT false NOT NULL,
    "revokedAt" timestamp(3) without time zone,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.tokens OWNER TO kiosk_user;

--
-- Name: users; Type: TABLE; Schema: public; Owner: kiosk_user
--

CREATE TABLE public.users (
    id text NOT NULL,
    email text NOT NULL,
    "passwordHash" text NOT NULL,
    role public."UserRole" DEFAULT 'USER'::public."UserRole" NOT NULL,
    "organizationId" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public.users OWNER TO kiosk_user;

--
-- Data for Name: _prisma_migrations; Type: TABLE DATA; Schema: public; Owner: kiosk_user
--

COPY public._prisma_migrations (id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count) FROM stdin;
8d16488b-1847-4b74-a767-d6bd57b2f7f6	b31cfb6628bf91737bb014b4be0bf9c4f8488f2926501d689b3a3450e539b212	2026-01-10 18:39:04.026191+00	20260110183903_init	\N	\N	2026-01-10 18:39:03.90475+00	1
\.


--
-- Data for Name: audit_logs; Type: TABLE DATA; Schema: public; Owner: kiosk_user
--

COPY public.audit_logs (id, action, "userId", "deviceId", "licenseId", details, "ipAddress", "userAgent", "createdAt") FROM stdin;
ef980852-dd16-425a-89b4-c746d3d52b13	admin_login_success	6f9aa650-a324-46c6-841c-404f5a05f33d	\N	\N	{"email": "admin@kiosk.local"}	::ffff:127.0.0.1	curl/7.81.0	2026-01-31 11:22:39.559
736a16e9-665b-47a5-ad01-71d234f5a8df	admin_login_success	6f9aa650-a324-46c6-841c-404f5a05f33d	\N	\N	{"email": "admin@kiosk.local"}	::ffff:127.0.0.1	curl/7.81.0	2026-01-31 13:01:51.808
a929d7ba-8bed-49cc-925b-add7368151bd	admin_login_success	6f9aa650-a324-46c6-841c-404f5a05f33d	\N	\N	{"email": "admin@kiosk.local"}	::ffff:127.0.0.1	curl/7.81.0	2026-01-31 13:03:41.851
98e58af6-9a4e-4ff1-9103-61c84d8b4614	license_update	6f9aa650-a324-46c6-841c-404f5a05f33d	\N	c56c49de-7d35-48fc-8bfd-d4207a381b9d	{"changes": {}}	::ffff:127.0.0.1	\N	2026-01-31 13:03:44.657
27f7b57a-e34d-4073-9c9e-604268e3aec7	admin_login_success	6f9aa650-a324-46c6-841c-404f5a05f33d	\N	\N	{"email": "admin@kiosk.local"}	::ffff:127.0.0.1	curl/7.81.0	2026-01-31 13:06:16.856
8f0b28cc-9b2b-442f-ab8a-5db0340b7c81	license_update	6f9aa650-a324-46c6-841c-404f5a05f33d	\N	c56c49de-7d35-48fc-8bfd-d4207a381b9d	{"changes": {}}	::ffff:127.0.0.1	\N	2026-01-31 13:06:19.737
fa79997c-fdbd-4c60-b42e-6cfe67b1bf0a	admin_login_success	6f9aa650-a324-46c6-841c-404f5a05f33d	\N	\N	{"email": "admin@kiosk.local"}	::ffff:127.0.0.1	curl/7.81.0	2026-02-01 08:04:59.389
f9c9439e-3744-4181-8e88-ada18016b60f	admin_login_success	6f9aa650-a324-46c6-841c-404f5a05f33d	\N	\N	{"email": "admin@kiosk.local"}	::ffff:127.0.0.1	curl/7.81.0	2026-02-01 08:08:52.566
bfd1e4e7-75d3-49bb-abfc-cb03769a7d78	admin_login_success	6f9aa650-a324-46c6-841c-404f5a05f33d	\N	\N	{"email": "admin@kiosk.local"}	::ffff:127.0.0.1	curl/7.81.0	2026-02-01 14:21:19.268
efa7f39b-dedf-48f2-97a0-a3d592e7f10f	admin_login_success	6f9aa650-a324-46c6-841c-404f5a05f33d	\N	\N	{"email": "admin@kiosk.local"}	::ffff:109.165.12.101	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36	2026-02-01 16:42:30.636
a57e14fd-c1df-40ee-a450-aab29230b2dd	admin_login_success	6f9aa650-a324-46c6-841c-404f5a05f33d	\N	\N	{"email": "admin@kiosk.local"}	::ffff:87.117.50.223	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36	2026-02-02 19:32:13.4
e861e665-401a-4367-a663-1ea68d18bd0f	admin_login_success	6f9aa650-a324-46c6-841c-404f5a05f33d	\N	\N	{"email": "admin@kiosk.local"}	127.0.0.1	curl/7.81.0	2026-02-02 19:36:01.091
\.


--
-- Data for Name: devices; Type: TABLE DATA; Schema: public; Owner: kiosk_user
--

COPY public.devices (id, "deviceId", "licenseId", "appType", "deviceName", "osInfo", status, "activatedAt", "deactivatedAt", "lastSeenAt", "createdAt", "updatedAt") FROM stdin;
b1606d76-c9c3-4626-a5a9-c82fe0812fcd	TEST-DEVICE-001	b5b35574-873e-4a9c-9f5d-024770da2992	EDITOR	Test Editor Device	{"platform":"linux","release":"Ubuntu 24.04","arch":"x64"}	ACTIVE	2026-01-31 07:47:01.235	\N	2026-01-31 07:47:01.235	2026-01-31 07:47:01.235	2026-01-31 07:47:01.235
4db63f25-4073-4877-8934-d40adcface0c	fix-test-1	b5b35574-873e-4a9c-9f5d-024770da2992	EDITOR	Fix Test	{"platform":"unknown"}	DEACTIVATED	2026-02-01 08:07:59.215	2026-02-01 14:21:19.592	2026-02-01 08:07:59.212	2026-02-01 08:07:59.215	2026-02-01 14:21:19.593
ac17794f-fc46-4701-8340-2c0c5bb529ef	test-device-1769864773	b5b35574-873e-4a9c-9f5d-024770da2992	EDITOR	Test Device Auto	{}	DEACTIVATED	2026-01-31 13:06:14.403	2026-02-01 14:21:19.744	2026-01-31 13:06:15.952	2026-01-31 13:06:14.403	2026-02-01 14:21:19.745
bb746a11-a665-4d82-936b-45bc47e7159d	test-device-1769864618	b5b35574-873e-4a9c-9f5d-024770da2992	EDITOR	Test Device Auto	{}	DEACTIVATED	2026-01-31 13:03:39.694	2026-02-01 14:21:19.903	2026-01-31 13:03:39.693	2026-01-31 13:03:39.694	2026-02-01 14:21:19.904
f624629a-b8c8-416e-a3a7-ffa93c6da41f	test-device-1769864508	b5b35574-873e-4a9c-9f5d-024770da2992	EDITOR	Test Device Auto	{}	DEACTIVATED	2026-01-31 13:01:49.908	2026-02-01 14:21:20.04	2026-01-31 13:01:49.906	2026-01-31 13:01:49.908	2026-02-01 14:21:20.041
8a39f822-4769-4366-ab3e-d36e2ff0401a	my-test-device-004	b5b35574-873e-4a9c-9f5d-024770da2992	EDITOR	My Test Editor	{}	DEACTIVATED	2026-01-31 12:31:46.19	2026-02-01 14:21:20.193	2026-01-31 12:31:46.188	2026-01-31 12:31:46.19	2026-02-01 14:21:20.194
7d384ef9-52c0-49d1-b084-e2c280eb380d	my-test-device-003	b5b35574-873e-4a9c-9f5d-024770da2992	EDITOR	My Test Editor	{}	DEACTIVATED	2026-01-31 12:25:53.641	2026-02-01 14:21:20.338	2026-01-31 12:25:53.638	2026-01-31 12:25:53.641	2026-02-01 14:21:20.339
460614e1-3bf4-4bc9-ab72-ffbcc5d359f8	full-cycle-1769955680	b5b35574-873e-4a9c-9f5d-024770da2992	EDITOR	Full Cycle Test	{"platform":"unknown"}	DEACTIVATED	2026-02-01 14:21:20.549	2026-02-01 14:21:21.022	2026-02-01 14:21:20.802	2026-02-01 14:21:20.549	2026-02-01 14:21:21.023
\.


--
-- Data for Name: licenses; Type: TABLE DATA; Schema: public; Owner: kiosk_user
--

COPY public.licenses (id, "licenseKey", "organizationId", plan, status, "seatsEditor", "seatsPlayer", "validFrom", "validUntil", "createdAt", "updatedAt") FROM stdin;
7b5044ac-f7af-4654-aa65-bfaa33906681	EWZA-E5LJ-Z558-9LUQ	de561091-5fa9-4812-9a61-7bbce7850d4e	BASIC	ACTIVE	1	3	2026-01-31 07:47:01.188	2027-01-31 07:47:01.188	2026-01-31 07:47:01.201	2026-01-31 07:47:01.201
b5b35574-873e-4a9c-9f5d-024770da2992	3VBN-8ZQ9-1MKO-AK0R	de561091-5fa9-4812-9a61-7bbce7850d4e	PRO	ACTIVE	5	10	2026-01-31 07:47:01.188	2027-01-31 07:47:01.188	2026-01-31 07:47:01.214	2026-01-31 07:47:01.214
c56c49de-7d35-48fc-8bfd-d4207a381b9d	T8MH-FJE3-ETAC-YOZF	de561091-5fa9-4812-9a61-7bbce7850d4e	MAX	ACTIVE	20	50	2026-01-31 07:47:01.188	2027-01-31 07:47:01.188	2026-01-31 07:47:01.219	2026-01-31 07:47:01.219
\.


--
-- Data for Name: organizations; Type: TABLE DATA; Schema: public; Owner: kiosk_user
--

COPY public.organizations (id, name, "ownerUserId", "createdAt", "updatedAt") FROM stdin;
de561091-5fa9-4812-9a61-7bbce7850d4e	Demo Organization	6f9aa650-a324-46c6-841c-404f5a05f33d	2026-01-31 07:47:01.153	2026-01-31 07:47:01.153
\.


--
-- Data for Name: tokens; Type: TABLE DATA; Schema: public; Owner: kiosk_user
--

COPY public.tokens (id, "deviceId", jti, "tokenHash", "expiresAt", revoked, "revokedAt", "createdAt") FROM stdin;
c5dd0c24-32ea-4097-9001-d8f1a9eaf3b8	8a39f822-4769-4366-ab3e-d36e2ff0401a	641a9d3a-1dc5-4b7d-8261-b1ea5c32b224	8c370f6e717f165c6c253ad0bed6289e37d428772d8b3db5a6753acdced873e2	2026-02-07 12:31:46	f	\N	2026-01-31 12:31:46.244
af88d357-4e15-4843-b27a-7f1a26389e5a	f624629a-b8c8-416e-a3a7-ffa93c6da41f	aa7af814-d5c2-40c4-86e3-9b3a254e4564	9112ae121748026ed109208c7a4f25581cd7677cc9fa7bcb0abc24ea5f9bb0d4	2026-02-07 13:01:49	f	\N	2026-01-31 13:01:49.941
ed954aba-d970-44ac-9c45-d5b5e93fbd26	bb746a11-a665-4d82-936b-45bc47e7159d	2ade0ce4-ca2d-4ebe-b2fd-617c63d9548f	7fdbd9dc4127ef1c2c5c5139a374f3a711408ec053593e11f4153ccd4713ebe6	2026-02-07 13:03:39	f	\N	2026-01-31 13:03:39.711
50f01831-d4f0-4517-ac52-0932d77ffacf	ac17794f-fc46-4701-8340-2c0c5bb529ef	b3a9bf6a-6338-4950-9f34-9930d36d9142	5edde9df2fb2a15dc2fc1ecd3dfdfae6679860c8645fc639e787f70a326e93cd	2026-02-07 13:06:14	f	\N	2026-01-31 13:06:14.427
b8766ea4-5c10-4859-a142-319773ef0626	ac17794f-fc46-4701-8340-2c0c5bb529ef	740282ea-236d-4fa9-aff1-36c1e3111bf7	3c699b6d32be703efe45cb3095e8fcac1ec58087bfd024b4f00ee4ec8df36115	2026-02-07 13:06:15	f	\N	2026-01-31 13:06:15.941
20d9936e-5eae-40cf-8c01-fa9411cf0028	4db63f25-4073-4877-8934-d40adcface0c	bff1c4c5-cf4c-4e19-bf6f-9077633601c6	21d96bf543cf88af0416d561c4ad69c9f90a35db0a30136749cf7e1c4157b457	2026-02-08 08:07:59	f	\N	2026-02-01 08:07:59.26
6a63edb3-9d8b-4c05-8bc5-58ab601e6704	460614e1-3bf4-4bc9-ab72-ffbcc5d359f8	5d8562da-98b9-452c-b766-13b4f9f0213b	dc46efd800701ee5a613a39e85d6c5df0ada201c66d85178c144e2f60e814b09	2026-02-08 14:21:20	f	\N	2026-02-01 14:21:20.565
cba01a0e-d152-4b92-ae62-c7f4fdaa058d	460614e1-3bf4-4bc9-ab72-ffbcc5d359f8	581086fd-f771-490e-9d8e-551381a028f3	9ed188f4db49fdcd979600626037b2f58c8c892ccf735ad86c6fed63520ab45c	2026-02-08 14:21:20	f	\N	2026-02-01 14:21:20.798
\.


--
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: kiosk_user
--

COPY public.users (id, email, "passwordHash", role, "organizationId", "createdAt", "updatedAt") FROM stdin;
6f9aa650-a324-46c6-841c-404f5a05f33d	admin@kiosk.local	$2b$10$OQOPEXec.xLR/oxwoRdMC.8PGF/aWTSe4s74R5r./jmyaksZ1hlZa	ADMIN	de561091-5fa9-4812-9a61-7bbce7850d4e	2026-01-31 07:47:01.153	2026-01-31 07:47:01.153
\.


--
-- Name: _prisma_migrations _prisma_migrations_pkey; Type: CONSTRAINT; Schema: public; Owner: kiosk_user
--

ALTER TABLE ONLY public._prisma_migrations
    ADD CONSTRAINT _prisma_migrations_pkey PRIMARY KEY (id);


--
-- Name: audit_logs audit_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: kiosk_user
--

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT audit_logs_pkey PRIMARY KEY (id);


--
-- Name: devices devices_pkey; Type: CONSTRAINT; Schema: public; Owner: kiosk_user
--

ALTER TABLE ONLY public.devices
    ADD CONSTRAINT devices_pkey PRIMARY KEY (id);


--
-- Name: licenses licenses_pkey; Type: CONSTRAINT; Schema: public; Owner: kiosk_user
--

ALTER TABLE ONLY public.licenses
    ADD CONSTRAINT licenses_pkey PRIMARY KEY (id);


--
-- Name: organizations organizations_pkey; Type: CONSTRAINT; Schema: public; Owner: kiosk_user
--

ALTER TABLE ONLY public.organizations
    ADD CONSTRAINT organizations_pkey PRIMARY KEY (id);


--
-- Name: tokens tokens_pkey; Type: CONSTRAINT; Schema: public; Owner: kiosk_user
--

ALTER TABLE ONLY public.tokens
    ADD CONSTRAINT tokens_pkey PRIMARY KEY (id);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: kiosk_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: audit_logs_action_idx; Type: INDEX; Schema: public; Owner: kiosk_user
--

CREATE INDEX audit_logs_action_idx ON public.audit_logs USING btree (action);


--
-- Name: audit_logs_createdAt_idx; Type: INDEX; Schema: public; Owner: kiosk_user
--

CREATE INDEX "audit_logs_createdAt_idx" ON public.audit_logs USING btree ("createdAt");


--
-- Name: audit_logs_deviceId_idx; Type: INDEX; Schema: public; Owner: kiosk_user
--

CREATE INDEX "audit_logs_deviceId_idx" ON public.audit_logs USING btree ("deviceId");


--
-- Name: audit_logs_licenseId_idx; Type: INDEX; Schema: public; Owner: kiosk_user
--

CREATE INDEX "audit_logs_licenseId_idx" ON public.audit_logs USING btree ("licenseId");


--
-- Name: audit_logs_userId_idx; Type: INDEX; Schema: public; Owner: kiosk_user
--

CREATE INDEX "audit_logs_userId_idx" ON public.audit_logs USING btree ("userId");


--
-- Name: devices_deviceId_idx; Type: INDEX; Schema: public; Owner: kiosk_user
--

CREATE INDEX "devices_deviceId_idx" ON public.devices USING btree ("deviceId");


--
-- Name: devices_deviceId_key; Type: INDEX; Schema: public; Owner: kiosk_user
--

CREATE UNIQUE INDEX "devices_deviceId_key" ON public.devices USING btree ("deviceId");


--
-- Name: devices_licenseId_idx; Type: INDEX; Schema: public; Owner: kiosk_user
--

CREATE INDEX "devices_licenseId_idx" ON public.devices USING btree ("licenseId");


--
-- Name: devices_status_idx; Type: INDEX; Schema: public; Owner: kiosk_user
--

CREATE INDEX devices_status_idx ON public.devices USING btree (status);


--
-- Name: licenses_licenseKey_idx; Type: INDEX; Schema: public; Owner: kiosk_user
--

CREATE INDEX "licenses_licenseKey_idx" ON public.licenses USING btree ("licenseKey");


--
-- Name: licenses_licenseKey_key; Type: INDEX; Schema: public; Owner: kiosk_user
--

CREATE UNIQUE INDEX "licenses_licenseKey_key" ON public.licenses USING btree ("licenseKey");


--
-- Name: licenses_organizationId_idx; Type: INDEX; Schema: public; Owner: kiosk_user
--

CREATE INDEX "licenses_organizationId_idx" ON public.licenses USING btree ("organizationId");


--
-- Name: licenses_status_idx; Type: INDEX; Schema: public; Owner: kiosk_user
--

CREATE INDEX licenses_status_idx ON public.licenses USING btree (status);


--
-- Name: organizations_ownerUserId_idx; Type: INDEX; Schema: public; Owner: kiosk_user
--

CREATE INDEX "organizations_ownerUserId_idx" ON public.organizations USING btree ("ownerUserId");


--
-- Name: tokens_deviceId_idx; Type: INDEX; Schema: public; Owner: kiosk_user
--

CREATE INDEX "tokens_deviceId_idx" ON public.tokens USING btree ("deviceId");


--
-- Name: tokens_expiresAt_idx; Type: INDEX; Schema: public; Owner: kiosk_user
--

CREATE INDEX "tokens_expiresAt_idx" ON public.tokens USING btree ("expiresAt");


--
-- Name: tokens_jti_idx; Type: INDEX; Schema: public; Owner: kiosk_user
--

CREATE INDEX tokens_jti_idx ON public.tokens USING btree (jti);


--
-- Name: tokens_jti_key; Type: INDEX; Schema: public; Owner: kiosk_user
--

CREATE UNIQUE INDEX tokens_jti_key ON public.tokens USING btree (jti);


--
-- Name: users_email_idx; Type: INDEX; Schema: public; Owner: kiosk_user
--

CREATE INDEX users_email_idx ON public.users USING btree (email);


--
-- Name: users_email_key; Type: INDEX; Schema: public; Owner: kiosk_user
--

CREATE UNIQUE INDEX users_email_key ON public.users USING btree (email);


--
-- Name: audit_logs audit_logs_deviceId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: kiosk_user
--

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT "audit_logs_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES public.devices(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: audit_logs audit_logs_licenseId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: kiosk_user
--

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT "audit_logs_licenseId_fkey" FOREIGN KEY ("licenseId") REFERENCES public.licenses(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: audit_logs audit_logs_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: kiosk_user
--

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT "audit_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: devices devices_licenseId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: kiosk_user
--

ALTER TABLE ONLY public.devices
    ADD CONSTRAINT "devices_licenseId_fkey" FOREIGN KEY ("licenseId") REFERENCES public.licenses(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: licenses licenses_organizationId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: kiosk_user
--

ALTER TABLE ONLY public.licenses
    ADD CONSTRAINT "licenses_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES public.organizations(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: organizations organizations_ownerUserId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: kiosk_user
--

ALTER TABLE ONLY public.organizations
    ADD CONSTRAINT "organizations_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: tokens tokens_deviceId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: kiosk_user
--

ALTER TABLE ONLY public.tokens
    ADD CONSTRAINT "tokens_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES public.devices(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: users users_organizationId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: kiosk_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES public.organizations(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- PostgreSQL database dump complete
--

\unrestrict glmdIf8QTC5k1rXJKYD6Y962Jf8iCxS0A6EMffG8zB5O7baArfHdqrPjeSNKhPc

