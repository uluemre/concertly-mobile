import React, { useState } from 'react';
import {
    View, Text, TextInput, TouchableOpacity,
    StyleSheet, Alert, ActivityIndicator
} from 'react-native';
import API from '../services/api';

export default function LoginScreen({ navigation }) {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);

    const handleLogin = async () => {
        if (!email || !password) {
            Alert.alert('Hata', 'Email ve şifre boş olamaz.');
            return;
        }
        setLoading(true);
        try {
            const res = await API.post('/auth/login', { email, password });
            global.authToken = res.data.accessToken;
            global.userId = res.data.userId;
            navigation.replace('MainApp');        } catch (err) {
            Alert.alert('Hata', 'Email veya şifre hatalı.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <View style={styles.container}>
            <Text style={styles.title}>🎵 Concertly</Text>
            <TextInput
                style={styles.input}
                placeholder="Email"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
            />
            <TextInput
                style={styles.input}
                placeholder="Şifre"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
            />
            {loading ? (
                <ActivityIndicator size="large" color="#6C63FF" />
            ) : (
                <TouchableOpacity style={styles.button} onPress={handleLogin}>
                    <Text style={styles.buttonText}>Giriş Yap</Text>
                </TouchableOpacity>
            )}
            <TouchableOpacity onPress={() => navigation.navigate('Register')}>
                <Text style={styles.link}>Hesabın yok mu? Kayıt ol</Text>
            </TouchableOpacity>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, justifyContent: 'center', padding: 24, backgroundColor: '#fff' },
    title: { fontSize: 32, fontWeight: 'bold', textAlign: 'center', marginBottom: 40, color: '#6C63FF' },
    input: { borderWidth: 1, borderColor: '#ddd', borderRadius: 10, padding: 14, marginBottom: 16, fontSize: 16 },
    button: { backgroundColor: '#6C63FF', padding: 16, borderRadius: 10, alignItems: 'center', marginBottom: 16 },
    buttonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
    link: { textAlign: 'center', color: '#6C63FF', fontSize: 14 },
});