export interface SampleDataset {
  id: string;
  name: string;
  filename: string;
  description: string;
  buildContent: () => string;
}

/**
 * Deterministic sample datasets covering mixed schemas, nested paths, Unicode/Persian text,
 * primitive roots, blank lines, and invalid JSON lines.
 */
export const SAMPLE_DATASETS: SampleDataset[] = [
  {
    id: 'llm-traces',
    name: 'LLM Inference Traces',
    filename: 'llm_inference_traces.jsonl',
    description: '43 lines · Nested objects & arrays, Unicode, blank lines & 3 invalid lines',
    buildContent: () => {
      const models = ['gpt-4.1-mini', 'claude-3.7-sonnet', 'gemini-2.5-pro', 'llama-3.3-70b'];
      const statuses = ['ok', 'ok', 'ok', 'rate_limited', 'timeout'];
      const regions = ['eu-central-1', 'us-east-1', 'ap-northeast-1'];
      const users = [
        { id: 'usr_101', name: 'Sara Mohammadi', role: 'admin', org: 'ParsData' },
        { id: 'usr_102', name: 'Daniel Park', role: 'engineer', org: 'VectorOps' },
        { id: 'usr_103', name: 'مریم رضایی', role: 'researcher', org: 'پژوهشگاه داده' },
        { id: 'usr_104', name: 'Elena Rostova', role: 'analyst', org: 'NordicML' },
        { id: 'usr_105', name: 'Ali Karimi', role: 'engineer', org: 'ParsData' },
      ];
      const prompts = [
        'Summarize Q3 incident postmortem in three bullet points.',
        'Extract invoice line items into normalized JSON.',
        'متن زیر را به زبان انگلیسی تخصصی ترجمه کن و اصطلاحات فنی را حفظ کن.',
        'Classify customer support ticket urgency and routing queue.',
        'Generate SQL window function to compute 7-day rolling retention.',
      ];

      const lines: string[] = [];
      for (let i = 0; i < 36; i++) {
        if (i === 7) {
          lines.push('');
        }
        if (i === 11) {
          lines.push('{"trace_id":"tr_err_01","model":"gemini-2.5-pro","latency_ms":420, INVALID_JSON}');
        }
        if (i === 19) {
          lines.push('   ');
        }
        if (i === 23) {
          lines.push('{"trace_id":"tr_err_02","user":{"name":"Truncated record"');
        }
        if (i === 31) {
          lines.push('[unclosed_array_line, 123, true');
        }

        const user = users[i % users.length];
        const model = models[i % models.length];
        const status = statuses[i % statuses.length];
        const latency = 95 + ((i * 73) % 920);
        const promptTokens = 120 + ((i * 47) % 1400);
        const completionTokens = status === 'ok' ? 64 + ((i * 31) % 640) : 0;
        const costUsd = Number(((promptTokens * 0.0000015) + (completionTokens * 0.000006)).toFixed(6));

        const record: Record<string, unknown> = {
          trace_id: `tr_${String(1001 + i)}`,
          timestamp: `2026-11-${String(10 + (i % 12)).padStart(2, '0')}T${String(8 + (i % 14)).padStart(2, '0')}:${String((i * 7) % 60).padStart(2, '0')}:12Z`,
          model,
          user,
          metadata: {
            status,
            region: regions[i % regions.length],
            cached: i % 4 === 0,
            retry_count: status === 'ok' ? 0 : (i % 3) + 1,
          },
          metrics: {
            latency_ms: latency,
            prompt_tokens: promptTokens,
            completion_tokens: completionTokens,
            cost_usd: costUsd,
          },
          messages: [
            { role: 'system', content: 'You are a concise structured extraction engine.' },
            { role: 'user', content: prompts[i % prompts.length] },
            ...(status === 'ok'
              ? [{ role: 'assistant', content: `Completed response #${i + 1} (${completionTokens} tokens).` }]
              : []),
          ],
          tags: i % 3 === 0 ? ['production', 'eval'] : i % 3 === 1 ? ['staging'] : [],
        };

        if (i % 5 === 0) {
          record.error_detail = status === 'ok' ? null : `Upstream ${status} after retry`;
        }
        if (i % 6 === 0) {
          record.score = i % 12 === 0 ? 'A+' : Number((0.72 + (i % 25) * 0.01).toFixed(2));
        }

        lines.push(JSON.stringify(record));
      }

      lines.push(JSON.stringify(['batch_marker', 'checkpoint_v1', 36]));
      lines.push(JSON.stringify('END_OF_STREAM_MARKER'));

      return lines.join('\n');
    },
  },
  {
    id: 'orders-stream',
    name: 'E-Commerce Event Log',
    filename: 'orders_events_2026.jsonl',
    description: '60 valid records · Clean tabular schema with numeric totals & nested line items',
    buildContent: () => {
      const currencies = ['USD', 'EUR', 'GBP'];
      const tiers = ['enterprise', 'pro', 'starter'];
      const countries = ['DE', 'US', 'NL', 'IR', 'JP', 'GB'];
      const lines: string[] = [];

      for (let i = 0; i < 60; i++) {
        const qty = (i % 5) + 1;
        const unitPrice = 19.5 + ((i * 17) % 240);
        const total = Number((qty * unitPrice).toFixed(2));

        lines.push(
          JSON.stringify({
            order_id: `ORD-${202600 + i}`,
            customer_email: `buyer${i + 1}@example.com`,
            tier: tiers[i % tiers.length],
            country: countries[i % countries.length],
            currency: currencies[i % currencies.length],
            amount: total,
            paid: i % 7 !== 0,
            discount_code: i % 4 === 0 ? `SAVE${(i % 3 + 1) * 10}` : null,
            items: [
              { sku: `SKU-${100 + (i % 15)}`, qty, unit_price: unitPrice },
              ...(i % 2 === 0 ? [{ sku: `ADDON-${(i % 4) + 1}`, qty: 1, unit_price: 9.0 }] : []),
            ],
            created_at: `2026-11-${String(1 + (i % 22)).padStart(2, '0')}T12:${String(i % 60).padStart(2, '0')}:00Z`,
          })
        );
      }
      return lines.join('\n');
    },
  },
];
