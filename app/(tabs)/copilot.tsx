import { useState, useRef } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import Markdown from 'react-native-markdown-display';
import { Theme } from '@/constants/Colors';
import { insertPlan } from '@/lib/db';

const API_URL = 'https://vanism-ai.vercel.app/api/copilot';

type Plan = { origin: string; destination: string; distance_miles: number; drive_time_minutes: number };
type Message = { role: 'user' | 'assistant'; content: string; plan?: Plan };

function formatDriveTime(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}min`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}min`;
}

function PlanCard({ plan, replyText }: { plan: Plan; replyText: string }) {
  const [approved, setApproved] = useState(false);

  function approve() {
    if (approved) return;
    insertPlan(plan.origin, plan.destination, plan.distance_miles, plan.drive_time_minutes, replyText);
    setApproved(true);
  }

  return (
    <View style={cardStyles.card}>
      <View style={cardStyles.route}>
        <Text style={cardStyles.location}>{plan.origin}</Text>
        <Text style={cardStyles.arrow}> → </Text>
        <Text style={cardStyles.location}>{plan.destination}</Text>
      </View>
      <Text style={cardStyles.meta}>{plan.distance_miles} mi · {formatDriveTime(plan.drive_time_minutes)}</Text>
      <TouchableOpacity style={[cardStyles.btn, approved && cardStyles.btnDone]} onPress={approve} disabled={approved}>
        <Text style={cardStyles.btnText}>{approved ? '✓ Saved to Plan' : 'Approve Plan'}</Text>
      </TouchableOpacity>
    </View>
  );
}

const markdownStyles = {
  body: { color: Theme.cream, fontFamily: 'Archivo', fontSize: 14, lineHeight: 22 },
  heading1: { color: Theme.cream, fontFamily: 'Archivo-Bold', fontSize: 16, marginBottom: 4, marginTop: 4 },
  heading2: { color: Theme.cream, fontFamily: 'Archivo-Bold', fontSize: 15, marginBottom: 4, marginTop: 8 },
  heading3: { color: Theme.cream, fontFamily: 'Archivo-SemiBold', fontSize: 14, marginBottom: 2, marginTop: 6 },
  strong: { color: '#B5C9B7', fontFamily: 'Archivo-Bold' },
  em: { color: Theme.cream, fontFamily: 'Archivo' },
  bullet_list: { marginVertical: 2 },
  ordered_list: { marginVertical: 2 },
  list_item: { marginVertical: 1 },
  hr: { backgroundColor: Theme.border, height: 1, marginVertical: 8 },
  code_inline: { backgroundColor: Theme.charcoal, color: Theme.cream, fontFamily: 'Courier', fontSize: 12, borderRadius: 3, paddingHorizontal: 4 },
  fence: { backgroundColor: Theme.charcoal, borderRadius: 6, padding: 10, marginVertical: 6 },
  blockquote: { backgroundColor: Theme.surface, borderLeftColor: Theme.rust, borderLeftWidth: 3, paddingLeft: 10, marginVertical: 4 },
  link: { color: Theme.rust },
};

export default function CopilotScreen() {
  const [messages, setMessages] = useState<Message[]>([
    { role: 'assistant', content: 'Copilot online. Where are you headed?' },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  async function send() {
    const text = input.trim();
    if (!text || loading) return;
    const next: Message[] = [...messages, { role: 'user', content: text }];
    setMessages(next);
    setInput('');
    setLoading(true);
    try {
      const res = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: next }),
      });
      const data = await res.json();
      setMessages(prev => [...prev, { role: 'assistant', content: data.reply ?? 'No response.', plan: data.plan ?? undefined }]);
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: 'No signal.' }]);
    }
    setLoading(false);
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
  }

  return (
    <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={90}>
      <ScrollView
        ref={scrollRef}
        style={styles.feed}
        contentContainerStyle={styles.feedContent}
        onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
      >
        {messages.map((m, i) => (
          <View key={i}>
            <View style={[styles.bubble, m.role === 'user' ? styles.userBubble : styles.aiBubble]}>
              {m.role === 'assistant' ? (
                <Markdown style={markdownStyles}>{m.content}</Markdown>
              ) : (
                <Text style={styles.userText}>{m.content}</Text>
              )}
            </View>
            {m.plan && <PlanCard plan={m.plan} replyText={m.content} />}
          </View>
        ))}
        {loading && (
          <View style={styles.loadingRow}>
            <ActivityIndicator size="small" color={Theme.muted} />
            <Text style={styles.loadingText}>reading the road...</Text>
          </View>
        )}
      </ScrollView>

      <View style={styles.inputRow}>
        <TextInput
          style={styles.input}
          value={input}
          onChangeText={setInput}
          placeholder="Ask the copilot..."
          placeholderTextColor={Theme.muted}
          onSubmitEditing={send}
          returnKeyType="send"
          multiline
        />
        <TouchableOpacity style={[styles.sendBtn, loading && styles.sendBtnDisabled]} onPress={send} disabled={loading}>
          <Text style={styles.sendLabel}>GO</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Theme.charcoal },
  feed: { flex: 1 },
  feedContent: { padding: 16, gap: 10 },
  bubble: { borderRadius: 14, paddingHorizontal: 14, paddingVertical: 10, maxWidth: '85%' },
  aiBubble: { backgroundColor: '#1E2225', alignSelf: 'flex-start', borderWidth: 1, borderColor: Theme.border },
  userBubble: { backgroundColor: Theme.moss, alignSelf: 'flex-end' },
  userText: { color: Theme.cream, fontFamily: 'Archivo', fontSize: 14, lineHeight: 20 },
  loadingRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 4 },
  loadingText: { color: Theme.muted, fontFamily: 'Archivo', fontSize: 12 },
  inputRow: { flexDirection: 'row', gap: 8, padding: 12, borderTopWidth: 1, borderTopColor: Theme.border, backgroundColor: Theme.charcoal },
  input: { flex: 1, backgroundColor: '#1E2225', borderWidth: 1, borderColor: Theme.border, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, fontSize: 14, color: Theme.cream, fontFamily: 'Archivo', maxHeight: 100 },
  sendBtn: { backgroundColor: Theme.rust, borderRadius: 10, paddingHorizontal: 18, justifyContent: 'center', alignItems: 'center' },
  sendBtnDisabled: { opacity: 0.5 },
  sendLabel: { color: Theme.cream, fontFamily: 'Archivo-Bold', fontSize: 13, letterSpacing: 1 },
});

const cardStyles = StyleSheet.create({
  card: { backgroundColor: Theme.surface, borderWidth: 1, borderColor: Theme.border, borderRadius: 12, padding: 14, marginTop: 6, marginBottom: 4 },
  route: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', marginBottom: 4 },
  location: { fontFamily: 'Archivo-SemiBold', fontSize: 14, color: Theme.cream },
  arrow: { fontFamily: 'Archivo-Bold', fontSize: 14, color: Theme.rust },
  meta: { fontFamily: 'Archivo', fontSize: 12, color: Theme.muted, marginBottom: 10 },
  btn: { backgroundColor: Theme.rust, borderRadius: 8, paddingVertical: 8, alignItems: 'center' },
  btnDone: { backgroundColor: Theme.moss },
  btnText: { fontFamily: 'Archivo-Bold', fontSize: 12, color: Theme.cream, letterSpacing: 0.6 },
});
