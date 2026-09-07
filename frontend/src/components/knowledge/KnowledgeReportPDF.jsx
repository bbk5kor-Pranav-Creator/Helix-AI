import React from 'react'
import { Document, Page, Text, View, StyleSheet, Svg, Line, Polygon } from '@react-pdf/renderer'

const C = {
  navy: '#14213D', red: '#C51F2B', redSoft: '#FCEBED', blue: '#2F6B9A',
  blueSoft: '#EAF3F9', green: '#287A63', greenSoft: '#EAF6F1',
  purple: '#6952A3', purpleSoft: '#F1EDFA', amber: '#A66A00', amberSoft: '#FFF6E5',
  ink: '#202833', muted: '#687482', line: '#D9E0E7', paper: '#FFFFFF', soft: '#F5F7F9', dark: '#15191F'
}

const S = StyleSheet.create({
  page: { size: 'A4', paddingTop: 42, paddingBottom: 46, paddingHorizontal: 42, backgroundColor: C.soft, color: C.ink, fontFamily: 'Helvetica', fontSize: 9, fontWeight: 500 },
  cover: { backgroundColor: C.dark, color: '#FFFFFF', padding: 48 },
  brandRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  mark: { width: 28, height: 28, borderRadius: 6, backgroundColor: C.red, alignItems: 'center', justifyContent: 'center' },
  markText: { color: '#FFFFFF', fontSize: 14, fontWeight: 700 },
  brandText: { color: '#FFFFFF', fontSize: 10, fontWeight: 700, letterSpacing: 2 },
  code: { color: '#98A2AE', fontSize: 7, letterSpacing: 1.5 },
  coverMain: { marginTop: 150 },
  kicker: { color: '#F07B82', fontSize: 8, fontWeight: 700, letterSpacing: 2 },
  coverTitle: { marginTop: 12, color: '#FFFFFF', fontSize: 29, lineHeight: 1.12, fontWeight: 700 },
  coverDesc: { fontWeight: 500, marginTop: 15, color: '#CBD2DA', fontSize: 11, lineHeight: 1.55, maxWidth: 430 },
  rule: { width: 48, height: 3, backgroundColor: C.red, marginTop: 24, marginBottom: 22 },
  metaGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 9, maxWidth: 450 },
  meta: { width: 210, minHeight: 55, padding: 10, borderRadius: 6, border: '1 solid #3B424B', backgroundColor: '#1D2229' },
  metaWide: { width: 429 },
  metaLabel: { color: '#8F98A3', fontSize: 6.5, fontWeight: 700, letterSpacing: 1, marginBottom: 5 },
  metaValue: { fontWeight: 500, color: '#F1F3F5', fontSize: 8.5, lineHeight: 1.35 },
  coverBottom: { position: 'absolute', left: 48, right: 48, bottom: 38, flexDirection: 'row', justifyContent: 'space-between', color: '#7E8791', fontSize: 7, letterSpacing: .7 },
  header: { marginBottom: 18 },
  eyebrow: { color: C.red, fontSize: 6.5, fontWeight: 700, letterSpacing: 1.5, marginBottom: 4 },
  pageTitle: { color: C.navy, fontSize: 19, fontWeight: 700 },
  pageSub: { color: C.muted, fontSize: 8, marginTop: 4, lineHeight: 1.4, maxWidth: 430 },
  section: { marginBottom: 17 },
  sectionTitle: { color: C.navy, fontSize: 11, fontWeight: 700, marginBottom: 7 },
  caption: { color: C.muted, fontSize: 7.5, marginBottom: 8 },
  summary: { padding: 14, borderRadius: 7, border: '1 solid #DDE3E8', borderLeft: '4 solid ' + C.red, backgroundColor: C.paper },
  summaryLabel: { color: C.red, fontSize: 6.5, fontWeight: 700, letterSpacing: 1.2, marginBottom: 7 },
  summaryText: { color: C.ink, fontSize: 9.5, fontWeight: 500, lineHeight: 1.55 },
  kpiRow: { flexDirection: 'row', gap: 8, marginTop: 10 },
  kpi: { flex: 1, padding: 10, borderRadius: 6, border: '1 solid ' + C.line, backgroundColor: C.paper },
  kpiValue: { color: C.navy, fontSize: 18, fontWeight: 700 },
  kpiLabel: { color: C.muted, fontSize: 6.5, fontWeight: 700, letterSpacing: .7, marginTop: 3 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { paddingVertical: 5, paddingHorizontal: 8, borderRadius: 12, border: '1 solid #D5DDE5', backgroundColor: C.paper, color: C.navy, fontSize: 7.2 },
  twoCol: { flexDirection: 'row', gap: 10 },
  col: { flex: 1 },
  card: { padding: 11, borderRadius: 6, border: '1 solid ' + C.line, backgroundColor: C.paper, marginBottom: 7 },
  row: { flexDirection: 'row', gap: 8 },
  number: { width: 22, color: C.red, fontSize: 7, fontWeight: 700 },
  body: { flex: 1, color: C.ink, fontSize: 8, fontWeight: 500, lineHeight: 1.45 },
  miniGrid: { flexDirection: 'row', gap: 8 },
  mini: { flex: 1, padding: 10, borderRadius: 6, border: '1 solid ' + C.line, backgroundColor: C.paper, minHeight: 78 },
  miniLabel: { fontSize: 6.5, fontWeight: 700, letterSpacing: .9, marginBottom: 7 },
  process: { padding: 12, borderRadius: 7, border: '1 solid ' + C.line, backgroundColor: C.paper },
  step: { flexDirection: 'row', alignItems: 'center', minHeight: 35 },
  circle: { width: 22, height: 22, borderRadius: 11, backgroundColor: C.red, alignItems: 'center', justifyContent: 'center', marginRight: 9 },
  circleText: { color: '#FFFFFF', fontSize: 7, fontWeight: 700 },
  stepText: { flex: 1, color: C.ink, fontSize: 8.2, fontWeight: 500, lineHeight: 1.35 },
  stepArrow: { marginLeft: 8, color: '#9AA4AE', fontSize: 12, height: 12 },
  risk: { flexDirection: 'row', gap: 8, padding: 10, borderRadius: 6, border: '1 solid #EBD9AE', borderLeft: '3 solid #D08A00', backgroundColor: C.amberSoft, marginBottom: 7 },
  riskNo: { color: C.amber, fontSize: 7, fontWeight: 700, width: 20 },
  riskText: { flex: 1, color: '#5F4B27', fontSize: 8, fontWeight: 500, lineHeight: 1.4 },
  graph: { padding: 12, borderRadius: 7, border: '1 solid ' + C.line, backgroundColor: '#F8FAFC' },
  graphTitle: { color: C.navy, fontSize: 8, fontWeight: 700, marginBottom: 10 },
  rel: { flexDirection: 'row', alignItems: 'center', marginBottom: 9 },
  node: { flex: 1, minHeight: 43, padding: 7, borderRadius: 6, justifyContent: 'center' },
  source: { border: '1 solid #E7B9BE', backgroundColor: C.redSoft },
  target: { border: '1 solid #C5DCEB', backgroundColor: C.blueSoft },
  nodeLabel: { fontSize: 5.5, fontWeight: 700, letterSpacing: .8, marginBottom: 3 },
  nodeText: { fontSize: 7.2, fontWeight: 700, lineHeight: 1.25 },
  relCenter: { width: 105, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 },
  relText: { color: C.muted, fontSize: 6.2, fontWeight: 500, textAlign: 'center', lineHeight: 1.2 },
  arrowSvg: { width: 24, height: 12, marginTop: 2 },
  question: { flexDirection: 'row', gap: 8, padding: 10, borderRadius: 6, border: '1 solid ' + C.line, borderTop: '3 solid ' + C.red, backgroundColor: C.paper, marginBottom: 7 },
  qNo: { width: 20, color: C.red, fontSize: 7, fontWeight: 700 },
  qText: { flex: 1, color: C.ink, fontSize: 8, fontWeight: 500, lineHeight: 1.4 },
  footer: { position: 'absolute', left: 42, right: 42, bottom: 22, paddingTop: 6, borderTop: '1 solid #D9E0E7', flexDirection: 'row', justifyContent: 'space-between', color: C.muted, fontSize: 6.5 }
})

const arr = v => Array.isArray(v) ? v.filter(Boolean) : []

function Chips({ items, style }) {
  return <View style={S.chips}>{arr(items).map((x, i) => <Text key={i} style={[S.chip, style]}>{String(x)}</Text>)}</View>
}

function Header({ eyebrow, title, caption }) {
  return <View style={S.header}><Text style={S.eyebrow}>{eyebrow}</Text><Text style={S.pageTitle}>{title}</Text>{caption ? <Text style={S.pageSub}>{caption}</Text> : null}</View>
}

function Footer() {
  return <View fixed style={S.footer}><Text>HELIX AI • KNOWLEDGE INTELLIGENCE</Text><Text render={({ pageNumber, totalPages }) => `PAGE ${pageNumber} / ${totalPages}`} /></View>
}

function Facts({ items }) {
  return <View>{arr(items).map((x, i) => <View key={i} style={S.card} wrap={false}><View style={S.row}><Text style={S.number}>{String(i + 1).padStart(2, '0')}</Text><Text style={S.body}>{String(x)}</Text></View></View>)}</View>
}

function Processes({ items }) {
  const values = arr(items)
  return <View style={S.process} wrap={false}>{values.map((x, i) => <React.Fragment key={i}><View style={S.step}><View style={S.circle}><Text style={S.circleText}>{i + 1}</Text></View><Text style={S.stepText}>{String(x)}</Text></View>{i < values.length - 1 ? <Text style={S.stepArrow}>↓</Text> : null}</React.Fragment>)}</View>
}

function Risks({ items }) {
  return <View>{arr(items).map((x, i) => <View key={i} style={S.risk} wrap={false}><Text style={S.riskNo}>{String(i + 1).padStart(2, '0')}</Text><Text style={S.riskText}>{String(x)}</Text></View>)}</View>
}

function Relationships({ items }) {
  return <View style={S.graph}><Text style={S.graphTitle}>SOURCE  •  RELATIONSHIP  •  TARGET</Text>{arr(items).map((r, i) => <View key={i} style={S.rel} wrap={false}><View style={[S.node, S.source]}><Text style={[S.nodeLabel, { color: C.red }]}>SOURCE</Text><Text style={[S.nodeText, { color: '#8F1B27' }]}>{String(r?.source || 'Unknown')}</Text></View><View style={S.relCenter}><Text style={S.relText}>{String(r?.relationship || 'related to')}</Text><Svg style={S.arrowSvg} width="24" height="12" viewBox="0 0 24 12"><Line x1="1" y1="6" x2="18" y2="6" stroke={C.red} strokeWidth="1.5" /><Polygon points="18,2 23,6 18,10" fill={C.red} /></Svg></View><View style={[S.node, S.target]}><Text style={[S.nodeLabel, { color: C.blue }]}>TARGET</Text><Text style={[S.nodeText, { color: '#285B82' }]}>{String(r?.target || 'Unknown')}</Text></View></View>)}</View>
}

function Questions({ items }) {
  return <View>{arr(items).map((x, i) => <View key={i} style={S.question} wrap={false}><Text style={S.qNo}>{String(i + 1).padStart(2, '0')}</Text><Text style={S.qText}>{String(x)}</Text></View>)}</View>
}

export default function KnowledgeReportPDF({ knowledge = {}, sourceInfo = {} }) {
  const topics = arr(knowledge.topics)
  const facts = arr(knowledge.key_facts)
  const entities = arr(knowledge.entities)
  const systems = arr(knowledge.systems)
  const tools = arr(knowledge.tools)
  const technologies = arr(knowledge.technologies)
  const processes = arr(knowledge.processes)
  const risks = arr(knowledge.risks)
  const relationships = arr(knowledge.relationships)
  const questions = arr(knowledge.suggested_questions)
  const sourceType = sourceInfo?.source_type === 'website' ? 'Website' : 'PDF'
  const sourceRef = sourceInfo?.url || sourceInfo?.filename || 'N/A'
  const title = sourceInfo?.title || knowledge.title || 'Knowledge Intelligence Report'
  const generated = new Date().toLocaleString()

  return <Document title={`${title} — Knowledge Intelligence Report`} author="Helix AI" subject="Knowledge Intelligence Report">
    <Page size="A4" style={[S.page, S.cover]}>
      <View style={S.brandRow}><View style={S.brand}><View style={S.mark}><Text style={S.markText}>H</Text></View><Text style={S.brandText}>HELIX AI</Text></View><Text style={S.code}>KI / REPORT</Text></View>
      <View style={S.coverMain}><Text style={S.kicker}>KNOWLEDGE INTELLIGENCE</Text><Text style={S.coverTitle}>{title}</Text><Text style={S.coverDesc}>A structured business intelligence report generated from an analyzed {sourceType.toLowerCase()} source.</Text><View style={S.rule} /><View style={S.metaGrid}><View style={S.meta}><Text style={S.metaLabel}>SOURCE TYPE</Text><Text style={S.metaValue}>{sourceType}</Text></View><View style={S.meta}><Text style={S.metaLabel}>GENERATED</Text><Text style={S.metaValue}>{generated}</Text></View><View style={[S.meta, S.metaWide]}><Text style={S.metaLabel}>SOURCE</Text><Text style={S.metaValue}>{sourceRef}</Text></View></View></View>
      <View style={S.coverBottom}><Text>STRUCTURED INTELLIGENCE</Text><Text>BUSINESS-READY ANALYSIS</Text></View>
    </Page>

    <Page size="A4" style={S.page}><Header eyebrow="01 / EXECUTIVE VIEW" title="Executive Intelligence" caption="A concise view of the most important signals identified in the analyzed source." />
      <View style={S.section}><View style={S.summary} wrap={false}><Text style={S.summaryLabel}>EXECUTIVE INSIGHT</Text><Text style={S.summaryText}>{knowledge.summary || 'No summary available.'}</Text></View><View style={S.kpiRow} wrap={false}><View style={S.kpi}><Text style={S.kpiValue}>{topics.length}</Text><Text style={S.kpiLabel}>TOPICS</Text></View><View style={S.kpi}><Text style={S.kpiValue}>{facts.length}</Text><Text style={S.kpiLabel}>KEY FACTS</Text></View><View style={S.kpi}><Text style={S.kpiValue}>{systems.length}</Text><Text style={S.kpiLabel}>SYSTEMS</Text></View><View style={S.kpi}><Text style={S.kpiValue}>{risks.length}</Text><Text style={S.kpiLabel}>RISKS</Text></View></View></View>
      <View style={S.section} wrap={false}><Text style={S.sectionTitle}>Key Topics</Text><Text style={S.caption}>Primary themes and areas of focus.</Text><Chips items={topics} style={{ backgroundColor: C.redSoft, borderColor: '#F0C7CC', color: '#9D1D28' }} /></View>
      <View style={S.section} wrap={false}><Text style={S.sectionTitle}>Knowledge Entities</Text><Text style={S.caption}>Named people, organizations, products and concepts.</Text><Chips items={entities} style={{ backgroundColor: C.blueSoft, borderColor: '#C8DDEB', color: '#285B82' }} /></View><Footer />
    </Page>

    <Page size="A4" style={S.page}><Header eyebrow="02 / EVIDENCE & LANDSCAPE" title="Knowledge Landscape" caption="Evidence, systems, tools and technologies identified across the source." />
      <View style={S.section}><Text style={S.sectionTitle}>Key Facts</Text><Facts items={facts} /></View>
      <View style={S.section} wrap={false}><Text style={S.sectionTitle}>Technology Landscape</Text><View style={S.miniGrid}><View style={S.mini}><Text style={[S.miniLabel, { color: C.purple }]}>SYSTEMS</Text><Chips items={systems} style={{ backgroundColor: C.purpleSoft, borderColor: '#D9CEF1', color: C.purple }} /></View><View style={S.mini}><Text style={[S.miniLabel, { color: C.green }]}>TOOLS</Text><Chips items={tools} style={{ backgroundColor: C.greenSoft, borderColor: '#C7E5D9', color: C.green }} /></View><View style={S.mini}><Text style={[S.miniLabel, { color: '#4C5A9B' }]}>TECHNOLOGIES</Text><Chips items={technologies} style={{ backgroundColor: '#EEF1FA', borderColor: '#D2D8EC', color: '#4C5A9B' }} /></View></View></View><Footer />
    </Page>

    <Page size="A4" style={S.page}><Header eyebrow="03 / OPERATING MODEL" title="Processes & Risk" caption="A structured view of the operating sequence and considerations surfaced by the analysis." />
      {processes.length > 0 ? <View style={S.section}><Text style={S.sectionTitle}>Process Flow</Text><Text style={S.caption}>Sequential activities identified in the source.</Text><Processes items={processes} /></View> : null}
      {risks.length > 0 ? <View style={S.section}><Text style={S.sectionTitle}>Risks & Considerations</Text><Text style={S.caption}>Items that may require attention, validation or management.</Text><Risks items={risks} /></View> : null}<Footer />
    </Page>

    <Page size="A4" style={S.page}><Header eyebrow="04 / KNOWLEDGE GRAPH" title="Knowledge Relationships" caption="Visual connections between important concepts extracted from the source." />
      {relationships.length > 0 ? <Relationships items={relationships} /> : <View style={S.card} wrap={false}><Text style={S.body}>No knowledge relationships were identified.</Text></View>}<Footer />
    </Page>

    <Page size="A4" style={S.page}><Header eyebrow="05 / NEXT QUESTIONS" title="Suggested Questions" caption="Useful follow-up questions for deeper investigation or management discussion." />
      {questions.length > 0 ? <Questions items={questions} /> : <View style={S.card} wrap={false}><Text style={S.body}>No suggested questions were generated.</Text></View>}
      <View style={{ marginTop: 18, padding: 14, borderRadius: 7, backgroundColor: C.navy }} wrap={false}><Text style={{ color: '#FFFFFF', fontSize: 9, fontWeight: 700 }}>Knowledge Intelligence Report</Text><Text style={{ color: '#AEB8C4', fontSize: 7.5, marginTop: 4 }}>Generated by Helix AI</Text></View><Footer />
    </Page>
  </Document>
}
