# SMS on AWS End User Messaging: runbook

Decision (2026-11-04, Arun: "go ahead with the AWS SMS plan"): each agent gets its own US toll-free number in Visybl's AWS account, starting with agent001. Twilio SMS is not used; Twilio 10DLC is never resubmitted.

- **AWS account:** 671013084319 (alias `visybl`), region **us-east-1**. The account is already in production mode for SMS there; nothing is provisioned yet.
- **Cost:** $2 a month per number, billed from the moment the number is requested, plus per-message charges. Toll-free registration has no fee.
- **Timing:** a toll-free registration takes up to 15 business days. The number cannot send until it is approved.
- **Who does what:**
  - Every AWS change is made by Arun, or by the Mac session with a scoped policy Arun attaches. Arun confirms each step.
  - This box builds the code and the pages while registration is pending.
  - No AWS keys pass through chat. The send-only key goes from the Mac straight into `~/a9n9/secrets/aws-sms.env` (mode 600) over SSH.

## agent001 (status 2026-11-04)

| Item | Value |
|---|---|
| Number | +1 (833) 334-0989, us-east-1, SMS and voice, TRANSACTIONAL, deletion protection on, tag agent=agent001 |
| Phone-number id | `phone-ac4ccbf660ab41ce94be6c35904012e0` |
| Registration id | `registration-1e32ba5dfb9643a2afe69302bc6dd451` (US_TOLL_FREE_REGISTRATION, associated, not yet submitted) |
| Step 1 | **done 2026-11-04:** TextMessageMonthlySpend approved at $20; the enforced spend-limit override is set to $20. (It was blocked at first: the account has no Service Quotas service-linked role (`DependencyAccessDeniedException`). Fix: Arun files the quota request once in the console (that creates the role), or the Mac policy gets `iam:CreateServiceLinkedRole` with condition `iam:AWSServiceName = servicequotas.amazonaws.com`. CLI: `aws service-quotas request-service-quota-increase --service-code sms-voice --quota-code L-2325465C --desired-value 20 --region us-east-1`.) |
| Step 2 | done 2026-11-04 12:52 EST |
| Step 3 | done: number on visybl.com/sms, /privacy and agent001.a9n9.net; screenshot `docs/sms-optin-agent001.png` (179 KB) |
| Step 4 | **submitted 2026-11-04 13:35 EST** (version 1, company VISYBL INC, category CUSTOMER_CARE because AWS has no Info-on-demand option, use-case text trimmed to the 500-character limit, opt-in PNG attached). Up to 15 business days. |
| Step 5 | done: topic `a9n9-sms-inbound`, two-way on, HTTPS subscription to `/aws/sms` confirmed by the phone service |
| Step 6 | done: `~/a9n9/secrets/aws-sms.env` (600), loaded by the phone container; verified with a read-only DescribePhoneNumbers (number PENDING). Sending stays on Twilio until approval (`SMS_BACKEND=aws` then). |

## Steps

| # | Step | Who | Waits on |
|---|---|---|---|
| 1 | Raise the spend quota: Service Quotas → AWS End User Messaging → `TextMessageMonthlySpend` → request **$20**, us-east-1, account level | Arun or Mac | — (AWS answers within 24 h) |
| 2 | Request one toll-free number: SMS and voice, message type TRANSACTIONAL, deletion protection on, tag `agent=agent001`. Note its phone-number id and the registration it creates. | Arun or Mac | — |
| 3 | Put the new number on visybl.com/sms, /privacy and agent001.a9n9.net; take the opt-in screenshot (PNG, 400 KB max) | this box | 2 |
| 4 | Fill in and submit the registration with the text below, plus the EIN and contact details from Arun | Arun or Mac | 3, Arun's details |
| 5 | Incoming texts: SNS topic `a9n9-sms-inbound`, with two-way enabled on the number and pointing at the topic. HTTPS subscription to `https://phone.a9n9.net/aws/sms` (this box confirms the subscription). | Arun or Mac | 2, and the endpoint deployed (this box) |
| 6 | Send-only IAM user `a9n9-sms-sender` with the policy below; its key written over SSH into `~/a9n9/secrets/aws-sms.env` | Arun or Mac | 2 |
| 7 | Switch the phone service's SMS backend to AWS (`SMS_BACKEND=aws` in `~/a9n9/docker-compose.yml`). Give agent001 a guarded `bin/sms-reply <event id> '<text>'`: it replies only to a pending `sms.received` sender, at most 160 characters × 2, no links unless asked, and logs to the ledger; mount the phone API token into the sandbox for it. Change the a9n9-respond skill from "SMS read-only until 10DLC" to answering by SMS. HELP keyword (Mac side). Then the end-to-end test: Arun texts the number, the agent replies with the disclosure first, STOP blocks, START restores, HELP answers. | this box (keyword: Mac) | registration approved |

## Scoped policy for the Mac session (attach for steps 1, 2, 4, 5 and 6; remove afterwards)

```json
{
  "Version": "2012-10-17",
  "Statement": [
    { "Sid": "SpendQuota", "Effect": "Allow",
      "Action": ["servicequotas:GetServiceQuota", "servicequotas:ListServiceQuotas", "servicequotas:RequestServiceQuotaIncrease", "servicequotas:ListRequestedServiceQuotaChangeHistory", "sms-voice:SetTextMessageSpendLimitOverride"],
      "Resource": "*" },
    { "Sid": "NumberAndRegistration", "Effect": "Allow",
      "Action": ["sms-voice:RequestPhoneNumber", "sms-voice:UpdatePhoneNumber", "sms-voice:CreateRegistration", "sms-voice:PutRegistrationFieldValue", "sms-voice:CreateRegistrationAttachment", "sms-voice:CreateRegistrationVersion", "sms-voice:SubmitRegistrationVersion", "sms-voice:CreateRegistrationAssociation", "sms-voice:PutKeyword", "sms-voice:TagResource", "sms-voice:Describe*"],
      "Resource": "*",
      "Condition": { "StringEquals": { "aws:RequestedRegion": "us-east-1" } } },
    { "Sid": "InboundTopic", "Effect": "Allow",
      "Action": ["sns:CreateTopic", "sns:SetTopicAttributes", "sns:GetTopicAttributes", "sns:Subscribe", "sns:ListSubscriptionsByTopic"],
      "Resource": "arn:aws:sns:us-east-1:671013084319:a9n9-sms-inbound" },
    { "Sid": "QuotasServiceLinkedRole", "Effect": "Allow", "Action": "iam:CreateServiceLinkedRole", "Resource": "*",
      "Condition": { "StringEquals": { "iam:AWSServiceName": "servicequotas.amazonaws.com" } } },
    { "Sid": "SenderUser", "Effect": "Allow",
      "Action": ["iam:CreateUser", "iam:TagUser", "iam:PutUserPolicy", "iam:CreateAccessKey"],
      "Resource": "arn:aws:iam::671013084319:user/a9n9-sms-sender" }
  ]
}
```

## Send-only policy for `a9n9-sms-sender` (the only AWS key on the box)

Replace `<phone-number-id>` after step 2. If AWS also asks for the opt-out-list ARN on send, add `arn:aws:sms-voice:us-east-1:671013084319:opt-out-list/Default` to `Resource`.

```json
{
  "Version": "2012-10-17",
  "Statement": [
    { "Effect": "Allow", "Action": "sms-voice:SendTextMessage",
      "Resource": "arn:aws:sms-voice:us-east-1:671013084319:phone-number/<phone-number-id>" },
    { "Effect": "Allow", "Action": ["sms-voice:DescribeOptedOutNumbers", "sms-voice:DescribePhoneNumbers"], "Resource": "*" }
  ]
}
```

SNS topic policy for step 5 (lets the SMS service publish incoming texts to the topic):

```json
{ "Version": "2012-10-17", "Statement": [ { "Effect": "Allow", "Principal": { "Service": "sms-voice.amazonaws.com" }, "Action": "sns:Publish",
  "Resource": "arn:aws:sns:us-east-1:671013084319:a9n9-sms-inbound", "Condition": { "StringEquals": { "aws:SourceAccount": "671013084319" } } } ] }
```

## Toll-free registration: the form (step 4)

Items marked **Arun** are not in this repository. Supply them at submission.

**Company**

| Field | Value |
|---|---|
| Company name | **Arun:** the exact legal name on the EIN record (for example "Visybl Inc" or "Visybl, Inc."; it must match the registry) |
| Website | https://www.visybl.com |
| Address | 5100 Buckeystown Pike, Suite 250, Frederick, MD 21704, US |
| Business type | Private profit |
| Company identification number | **Arun:** EIN, type EIN, country US |

**Contact**

| Field | Value |
|---|---|
| Name, support email, support phone (`+1…` with no spaces) | **Arun:** a real person at Visybl |

**Use case**

| Field | Value |
|---|---|
| Monthly SMS volume | the lowest bracket offered (we expect under 1,000) |
| Use case category | Customer care (the API has no Info-on-demand option) |
| Privacy Policy URL | https://www.visybl.com/privacy |
| Terms and Conditions URL | https://www.visybl.com/sms |
| Opt-in category | Text |
| Opt-in workflow image | `docs/sms-optin-agent001.png` (visybl.com/sms showing the number and "How you opt in") |

**Use case details:**
> People text Visybl's number with questions about Visybl's a9n9 service and the public data it publishes (for example the stablecoin reserve figures at https://reserves.a9n9.net), and Visybl's automated agent texts back the answer. If the person asks for it in their text, Visybl also texts them when a figure they named changes. Visybl only ever replies to a number that texted it first. There is no marketing, no promotions, no purchased or shared lists, and no third-party content. Every message starts with "Visybl:" and the first reply says replies are automated.

**Opt-in workflow description:**
> The only way to opt in is for the person to send a text message (any message, for example a question or START) to the number. The number is published on https://www.visybl.com/sms, where the program terms are shown next to it, and on the agent's public page https://agent001.a9n9.net. Visybl never texts a number that has not texted it first, and never adds numbers from the website, forms, calls, email or lists. Visybl keeps the inbound text (number, time, message) as the record of consent. The first reply is: "Visybl: Thanks for texting Visybl. Replies come from Visybl's automated agent, not a person. Msg frequency varies. Msg & data rates may apply. Reply HELP for help, STOP to opt out." STOP (and CANCEL, END, QUIT, UNSUBSCRIBE) opts out immediately with one confirmation; HELP returns the support contact.

**Message samples:**
1. `Visybl: Thanks for texting Visybl. Replies come from Visybl's automated agent, not a person. Msg frequency varies. Msg & data rates may apply. Reply HELP for help, STOP to opt out.`
2. `Visybl: As of 16:40 UTC, pathUSD has 40.3 million dollars on Tempo and the issuer reports 40.3 million in reserves, so it reconciles. Reply STOP to opt out.`
3. `Visybl: The alert you asked for: USDB supply on Tempo moved from 40.4 million to 55.1 million dollars in the last hour. Reply STOP to opt out.`

**First reply:** the phone service adds the disclosure above to the first message sent to any new number, so the agent cannot forget it.

**Keywords (`PutKeyword` after the number exists):**
- HELP → `Visybl: automated answers about Visybl's a9n9 service. Help: agent001@a9n9.net or https://www.visybl.com/sms. Msg & data rates may apply. Reply STOP to opt out.`
- STOP → the AWS default opt-out, kept.

## Per-agent numbers later

Each new agent repeats steps 2–6 with its own number, page section and tag. The registration text changes only in the agent's name and page. The fleet provisioner prints these steps as part of the per-agent checklist (see `fleet.md`).
