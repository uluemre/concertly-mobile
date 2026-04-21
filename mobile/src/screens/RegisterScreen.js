import React, { useState } from 'react';
import {
    View, Text, TextInput, TouchableOpacity,
    StyleSheet, Alert, ActivityIndicator
} from 'react-native';
import API from '../services/api';

export default function RegisterScreen({ navigation }) {
    const [username, setUsername] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);

    const handleRegister = async () => {
        if (!username || !email || !password) {
            Alert.alert('Hata', 'Tüm alanları doldurun.');
            return;
        }
        setLoading(true);
        try {
            await API.post('/auth/register', { username, email, password });
            Alert.alert('Başarılı', 'Hesabın oluşturuldu!', [
                { text: 'Giriş Yap', onPress: () => navigation.replace('Login') }
            ]);
        } catch (err) {
            Alert.alert('Hata', 'Bu email veya kullanıcı adı zaten kullanılıyor.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <View style={styles.container}>
            <Text style={styles.title}>🎵 Kayıt Ol</Text>
            <TextInput
                style={styles.input}
                placeholder="Kullanıcı adı"
                value={username}
                onChangeText={setUsername}
                autoCapitalize="none"
            />
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
                <TouchableOpacity style={styles.button} onPress={handleRegister}>
                    <Text style={styles.buttonText}>Kayıt Ol</Text>
                </TouchableOpacity>
            )}
            <TouchableOpacity onPress={() => navigation.navigate('Login')}>
                <Text style={styles.link}>Zaten hesabın var mı? Giriş yap</Text>
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