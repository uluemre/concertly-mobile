import React, { useEffect, useState } from 'react';
import {
    View, Text, FlatList, StyleSheet,
    ActivityIndicator, TouchableOpacity
} from 'react-native';
import API from '../services/api';

export default function HomeScreen({ navigation }) {
    const [events, setEvents] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        API.get('/events')
            .then(res => setEvents(res.data))
            .catch(() => { })
            .finally(() => setLoading(false));
    }, []);

    if (loading) return <ActivityIndicator style={{ flex: 1 }} size="large" color="#6C63FF" />;

    return (
        <View style={styles.container}>
            <Text style={styles.title}>🎵 Etkinlikler</Text>
            <FlatList
                data={events}
                keyExtractor={item => item.id.toString()}
                renderItem={({ item }) => (
                    <View style={styles.card}>
                        <Text style={styles.eventName}>{item.name}</Text>
                        <Text style={styles.eventDesc}>{item.description}</Text>
                        <Text style={styles.eventDate}>
                            📅 {new Date(item.eventDate).toLocaleDateString('tr-TR')}
                        </Text>
                    </View>
                )}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#f5f5f5', padding: 16, paddingTop: 50 },
    title: { fontSize: 24, fontWeight: 'bold', color: '#6C63FF', marginBottom: 16 },
    card: { backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 12, elevation: 2 },
    eventName: { fontSize: 18, fontWeight: 'bold', color: '#333' },
    eventDesc: { color: '#666', marginTop: 4 },
    eventDate: { color: '#6C63FF', marginTop: 8, fontWeight: '600' },
});