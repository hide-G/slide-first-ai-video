# Cost Allocation and Tracking

This document describes the cost allocation tag setup procedure and tracking strategy for the Slide-First AI Video platform.

## Cost Allocation Tags

### Tags Used

| Tag Key     | Description                          | Applied To           |
|-------------|--------------------------------------|----------------------|
| projectId   | Unique project identifier (ULID)     | All resources        |
| renderId    | Unique render execution identifier   | Render-phase costs   |
| userId      | Cognito user sub (UUID)              | All resources        |

### Enabling Tags in AWS Billing Console

1. Navigate to AWS Billing Console > Cost Allocation Tags
2. Select "User-defined cost allocation tags"
3. Activate the following tags:
   - `projectId`
   - `renderId`
   - `userId`
4. Tags become active within 24 hours of activation
5. Only costs incurred after activation are tagged (not retroactive)

## Per-Service Cost Tracking

### Amazon Bedrock (Outline + Narration Generation)

**Application Inference Profile:**

1. Create an application inference profile in the Bedrock console
2. Assign tags: `projectId`, `userId`
3. Use the inference profile ARN when invoking the Converse API
4. Track costs via `usage.inputTokens` and `usage.outputTokens` from the API response

**Recording:**
- Input tokens and output tokens are captured from the Bedrock Converse API response
- Stored in the manifest `cost.stages[]` array with `service: "bedrock"`
- Estimated cost = (inputTokens * inputPricePerToken) + (outputTokens * outputPricePerToken)

### Amazon Polly (Audio Synthesis)

**Cost Signal:**
- `RequestCharacters` from the SynthesizeSpeech response headers
- Characters billed per request are returned in `x-amz-request-characters`

**Recording:**
- Each polly-worker invocation records `{ service: "polly", usage: { characters: N } }`
- Stored per-page in the cost tracking structure
- Estimated cost = characters * pricePerCharacter (varies by engine: standard vs neural)

### AWS Lambda (Compute)

**Cost Signal:**
- GB-seconds from Lambda execution context (`memoryLimitInMB * billedDurationMs / 1000`)
- Available in CloudWatch Logs and the REPORT line

**Recording:**
- Each stage worker reports execution duration and memory usage
- Stored as `{ service: "lambda", usage: { gbSeconds: N, invocations: N } }`
- Estimated cost = gbSeconds * pricePerGbSecond + invocations * pricePerInvocation

### Amazon S3 (Storage)

**Cost Signal:**
- Object count and total size tracked per project prefix
- PUT/GET request counts from CloudWatch metrics

**Recording:**
- Object count and size updated after each stage completes
- Stored as `{ service: "s3", usage: { objectCount: N, totalSizeBytes: N, putRequests: N, getRequests: N } }`
- Estimated cost = storageCost + requestCost

### AWS Step Functions (Orchestration)

**Cost Signal:**
- State transition count from the execution history
- Available via `DescribeExecution` API after completion

**Recording:**
- Transition count recorded after render pipeline completes
- Stored as `{ service: "stepfunctions", usage: { stateTransitions: N } }`
- Estimated cost = stateTransitions * pricePerTransition

## Manifest Cost Structure

Each render stores cost data in the manifest:

```json
{
  "cost": {
    "currency": "USD",
    "priceListFetchedAt": "2024-01-01T00:00:00.000Z",
    "stages": [
      {
        "stage": "outline",
        "service": "bedrock",
        "usage": { "inputTokens": 1500, "outputTokens": 3000 },
        "estimatedCost": 0.045
      },
      {
        "stage": "audio",
        "service": "polly",
        "usage": { "characters": 5000 },
        "estimatedCost": 0.02
      },
      {
        "stage": "clips",
        "service": "lambda",
        "usage": { "gbSeconds": 120, "invocations": 10 },
        "estimatedCost": 0.002
      }
    ],
    "estimatedTotal": 0.067,
    "actual": {
      "status": "pending",
      "amount": null,
      "reconciledAt": null
    }
  }
}
```

## Reconciliation

After a render completes:

1. Estimated costs are summed from all stages
2. `actual.status` remains "pending" until AWS Cost Explorer data is available (24-48 hours)
3. A scheduled reconciliation job can query Cost Explorer with the `renderId` tag
4. Once reconciled: `actual.status = "reconciled"`, `actual.amount = <real cost>`, `actual.reconciledAt = <timestamp>`

## Dashboard Queries

Use AWS Cost Explorer with tag filters:
- Per-user costs: filter by `userId` tag
- Per-project costs: filter by `projectId` tag
- Per-render costs: filter by `renderId` tag
- Per-service breakdown: group by service within a tag filter
