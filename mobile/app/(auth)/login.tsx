import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { Link, useRouter } from 'expo-router';
import { useAuthStore } from '../../src/stores/authStore';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const login = useAuthStore((state) => state.login);
  const isLoading = useAuthStore((state) => state.isLoading);
  const router = useRouter();
  const [showDemos, setShowDemos] = useState(false);

  const handleLogin = async () => {
    try {
      setError('');
      await login(email, password);
      router.replace('/');
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || 'Login failed');
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Welcome Back</Text>
      
      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      <TextInput
        style={styles.input}
        placeholder="Email"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
      />
      
      <TextInput
        style={styles.input}
        placeholder="Password"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
      />

      <TouchableOpacity style={styles.button} onPress={handleLogin} disabled={isLoading}>
        {isLoading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Log In</Text>}
      </TouchableOpacity>

      <Link href="/register" style={styles.link}>
        <Text style={styles.linkText}>Don't have an account? Sign up</Text>
      </Link>

      <TouchableOpacity style={styles.demoToggle} onPress={() => setShowDemos(!showDemos)}>
        <Text style={styles.demoToggleText}>Quick Demo Logins {showDemos ? '▼' : '▶'}</Text>
      </TouchableOpacity>

      {showDemos && (
        <View style={styles.demoBox}>
          <TouchableOpacity style={styles.demoBtn} onPress={() => { setEmail('guest1@example.com'); setPassword('password123'); }}>
            <Text style={styles.demoBtnText}>👤 Login as Guest</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.demoBtn} onPress={() => { setEmail('host1@example.com'); setPassword('password123'); }}>
            <Text style={styles.demoBtnText}>🏠 Login as Host</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.demoBtn} onPress={() => { setEmail('admin@example.com'); setPassword('password123'); }}>
            <Text style={styles.demoBtnText}>⚙️ Login as Admin</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, justifyContent: 'center', backgroundColor: '#fff' },
  title: { fontSize: 32, fontWeight: 'bold', marginBottom: 32, textAlign: 'center', color: '#333' },
  input: { backgroundColor: '#f5f5f5', padding: 16, borderRadius: 8, marginBottom: 16, fontSize: 16 },
  button: { backgroundColor: '#007AFF', padding: 16, borderRadius: 8, alignItems: 'center', marginTop: 8 },
  buttonText: { color: '#fff', fontSize: 18, fontWeight: '600' },
  errorText: { color: 'red', marginBottom: 16, textAlign: 'center' },
  link: { marginTop: 24, alignItems: 'center' },
  linkText: { color: '#007AFF', fontSize: 16 },
  demoToggle: { marginTop: 32, alignItems: 'center' },
  demoToggleText: { color: '#666', fontSize: 14, fontWeight: 'bold' },
  demoBox: { marginTop: 16, backgroundColor: '#f9f9f9', padding: 16, borderRadius: 8, borderWidth: 1, borderColor: '#eee' },
  demoBtn: { paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#eee' },
  demoBtnText: { fontSize: 16, color: '#333' }
});
