import React from 'react';
import { StyleSheet, Text, View, TouchableOpacity, Alert } from 'react-native';

export default function App() {
  const handleGuestAccess = () => {
    // Aquí puedes redirigir al usuario o mostrar el panel principal directamente
    Alert.alert('Acceso libre', 'Has entrado sin iniciar sesión.');
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Envío Seguro</Text>
      
      <TouchableOpacity 
        style={styles.button}
        onPress={handleGuestAccess}
      >
        <Text style={styles.buttonText}>Entrar como invitado / Sin registro</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#fff',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 30,
  },
  button: {
    width: '100%',
    height: 50,
    backgroundColor: '#34C759', // Verde para acceso libre
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 8,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});