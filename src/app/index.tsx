import 'react-native-get-random-values';
import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  Button,
  StyleSheet,
  Alert,
  TextInput,
  TouchableOpacity,
  ScrollView,
  NativeModules,
  AppState,
  AppStateStatus,
  Share,
} from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import CryptoJS from 'crypto-js';
import * as LocalAuthentication from 'expo-local-authentication';
import * as Linking from 'expo-linking';
import { Camera } from 'expo-camera';

// Detectar idioma del dispositivo
const deviceLanguage = NativeModules.I18nManager?.localeIdentifier || 'es';
const isSpanish = deviceLanguage.startsWith('es');

const MAX_FILES = 10;
const MAX_TOTAL_SIZE_MB = 50;

const i18n = {
  title: 'Enygma Crypt',
  passPlaceholder: isSpanish ? 'Escribe la contraseña secreta' : 'Enter secret password',
  passHelp: isSpanish
    ? '💡 Escribe la contraseña con la que cifrarás los archivos. Deberás facilitársela a tu contacto por vía segura.'
    : '💡 Type the secret password to encrypt your files. Share it with your contact securely.',

  step1: isSpanish ? '1. Seleccionar Archivos' : '1. Select Files',
  step1Gallery: isSpanish ? '🖼️ Galería' : '🖼️ Gallery',
  step1Camera: isSpanish ? '📷 Cámara' : '📷 Camera',
  step1Help: isSpanish
    ? `📌 Elige o toma hasta ${MAX_FILES} archivos (máx. ${MAX_TOTAL_SIZE_MB}MB) para encriptar.`
    : `📌 Choose or capture up to ${MAX_FILES} files (max. ${MAX_TOTAL_SIZE_MB}MB) to encrypt.`,
  selected: isSpanish ? 'Seleccionados:' : 'Selected:',

  step2: isSpanish ? '2. Encriptar Archivos' : '2. Encrypt Files',
  step2Help: isSpanish
    ? '⚙️ Genera un archivo .enygma ocultando el contenido y las extensiones originales.'
    : '⚙️ Generates a .enygma file hiding original content and extensions.',

  step3: isSpanish ? '3. Enviar Archivo Protegido' : '3. Send Protected File',
  step3Help: isSpanish
    ? '🚀 Envía el archivo cifrado (.enygma) mediante la aplicación que prefieras.'
    : '🚀 Send the encrypted file (.enygma) through your preferred app.',

  receivedSection: isSpanish ? '¿Tienes un archivo recibido?' : 'Have a received file?',
  stepDecrypt: isSpanish ? '🔓 Seleccionar y Abrir Archivo' : '🔓 Select and Open File',
  decryptHelp: isSpanish
    ? '🔑 Introduce la contraseña recibida y busca el archivo .enygma para descifrarlo.'
    : '🔑 Enter the received password and pick the .enygma file to decrypt it.',

  shareAppBtn: isSpanish ? '📲 Compartir App e Instrucciones' : '📲 Share App & Instructions',
  shareAppHelp: isSpanish
    ? '✉️ Envía el enlace e instrucciones al receptor para que sepa cómo abrir tu archivo.'
    : '✉️ Send instructions and app info so the recipient knows how to open your file.',

  lockTitle: '🔒 Enygma Crypt',
  lockSubtitle: isSpanish ? 'Se requiere verificación para ingresar' : 'Verification required to enter',
  unlockBtn: isSpanish ? 'Desbloquear con Huella / Facial / PIN' : 'Unlock with Fingerprint / Face / PIN',

  alertAttention: isSpanish ? 'Atención' : 'Attention',
  alertPassReq: isSpanish ? 'Por favor, introduce una contraseña.' : 'Please enter a password.',
  alertSuccessEnc: isSpanish ? 'Archivos encriptados correctamente.' : 'Files encrypted successfully.',
  alertWrongPass: isSpanish ? 'Contraseña incorrecta o archivo dañado.' : 'Incorrect password or corrupted file.',
  alertPermissionDenied: isSpanish ? 'Se necesita permiso para acceder.' : 'Permission required.',

  shareInstructionsMsg: isSpanish
    ? '🔒 *Enygma Crypt - Archivo Protegido*\n\nTe he enviado un archivo encriptado. Para poder abrirlo y descifrar su contenido necesitas la aplicación *Enygma Crypt*.\n\nPasos para abrirlo:\n1. Instala la app Enygma Crypt.\n2. Abre la app e introduce la contraseña secreta que te facilitaré.\n3. Pulsa en "🔓 Seleccionar y Abrir Archivo" y elige el archivo .enygma recibido.'
    : '🔒 *Enygma Crypt - Protected File*\n\nI sent you an encrypted file. To open and decrypt it you need the *Enygma Crypt* app.\n\nSteps to open:\n1. Install Enygma Crypt.\n2. Open the app and enter the secret password provided.\n3. Tap "🔓 Select and Open File" and pick the received .enygma file.',
};

export default function HomeScreen() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [password, setPassword] = useState<string>('');
  const [filesData, setFilesData] = useState<any[]>([]);
  const [encryptedPath, setEncryptedPath] = useState<string | null>(null);
  const [isEncrypting, setIsEncrypting] = useState<boolean>(false);
  const [encryptProgress, setEncryptProgress] = useState<number>(0);

  const appState = useRef(AppState.currentState);
  const backgroundTimeRef = useRef<number | null>(null);

  // Escuchar cuando se abre un archivo .enygma desde WhatsApp o el gestor de archivos
  useEffect(() => {
    const handleInitialUrl = async () => {
      const url = await Linking.getInitialURL();
      if (url && url.endsWith('.enygma')) {
        Alert.alert('Enygma Crypt', 'Se ha detectado un archivo recibido. Introduce la contraseña y pulsa Desencriptar.');
      }
    };
    handleInitialUrl();

    const subscription = Linking.addEventListener('url', (event) => {
      if (event.url && event.url.endsWith('.enygma')) {
        Alert.alert('Enygma Crypt', 'Archivo .enygma cargado.');
      }
    });

    return () => subscription.remove();
  }, []);

  // Control de biometría inicial + Re-bloqueo tras 30 segundos en segundo plano
  useEffect(() => {
    authenticateUser();

    const subscription = AppState.addEventListener('change', (nextAppState: AppStateStatus) => {
      if (appState.current.match(/active/) && nextAppState.match(/inactive|background/)) {
        backgroundTimeRef.current = Date.now();
      }

      if (appState.current.match(/inactive|background/) && nextAppState === 'active') {
        if (backgroundTimeRef.current) {
          const elapsedSeconds = (Date.now() - backgroundTimeRef.current) / 1000;
          if (elapsedSeconds >= 30) {
            setIsAuthenticated(false);
            authenticateUser();
          }
        }
      }
      appState.current = nextAppState;
    });

    return () => {
      subscription.remove();
    };
  }, []);

  const authenticateUser = async () => {
    try {
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      const isEnrolled = await LocalAuthentication.isEnrolledAsync();

      if (!hasHardware || !isEnrolled) {
        setIsAuthenticated(true);
        return;
      }

      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Enygma Crypt Authentication',
        fallbackLabel: 'Use PIN',
        cancelLabel: 'Cancel',
        disableDeviceFallback: false,
      });

      if (result.success) {
        setIsAuthenticated(true);
      } else {
        setIsAuthenticated(false);
      }
    } catch (error) {
      console.error('Authentication error:', error);
      Alert.alert('Error', 'Verification failed.');
    }
  };

  // Función para validar límites de seguridad (Máximo 10 archivos o 50 MB)
  const validateAndAddFiles = (newFiles: any[]) => {
    if (filesData.length + newFiles.length > MAX_FILES) {
      Alert.alert(i18n.alertAttention, `Máximo ${MAX_FILES} archivos por lote.`);
      return;
    }

    const updatedList = [...filesData, ...newFiles];
    setFilesData(updatedList);
    setEncryptedPath(null);
  };

  const pickFile = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        copyToCacheDirectory: true,
        multiple: true,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const formatted = result.assets.map((asset) => ({
          uri: asset.uri,
          name: asset.name,
          mimeType: asset.mimeType || 'application/octet-stream',
          size: asset.size,
        }));
        validateAndAddFiles(formatted);
      }
    } catch (error: any) {
      Alert.alert('Error', error?.message || 'Error picking file');
    }
  };

  const pickImageFromGallery = async () => {
    try {
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permissionResult.granted) {
        Alert.alert(i18n.alertAttention, i18n.alertPermissionDenied);
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.All,
        allowsMultipleSelection: true,
        quality: 0.8, // Optimización de peso para acelerar la velocidad de cifrado
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const formatted = result.assets.map((asset, index) => ({
          uri: asset.uri,
          name: asset.fileName || `media_${Date.now()}_${index}.${asset.type === 'video' ? 'mp4' : 'jpg'}`,
          mimeType: asset.mimeType || (asset.type === 'video' ? 'video/mp4' : 'image/jpeg'),
          size: asset.fileSize,
        }));
        validateAndAddFiles(formatted);
      }
    } catch (error: any) {
      Alert.alert('Error', error?.message || 'Error picking image');
    }
  };

  // Novedad: Tomar foto desde la Cámara
  const takePhotoWithCamera = async () => {
    try {
      const { status } = await Camera.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(i18n.alertAttention, i18n.alertPermissionDenied);
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.8,
      });

      if (!result.canceled && result.assets && result.assets[0]) {
        const asset = result.assets[0];
        const newPhoto = {
          uri: asset.uri,
          name: `photo_${Date.now()}.jpg`,
          mimeType: 'image/jpeg',
          size: asset.fileSize,
        };
        validateAndAddFiles([newPhoto]);
      }
    } catch (error: any) {
      Alert.alert('Error', error?.message || 'Error taking photo');
    }
  };

  // Encriptar archivos con barra de progreso
  const encryptFile = async () => {
    if (filesData.length === 0) return;
    if (!password.trim()) {
      Alert.alert(i18n.alertAttention, i18n.alertPassReq);
      return;
    }

    setIsEncrypting(true);
    setEncryptProgress(0);

    try {
      const processedItems = [];
      const total = filesData.length;

      for (let i = 0; i < total; i++) {
        const file = filesData[i];
        const tempPath = `${FileSystem.cacheDirectory}temp_${Date.now()}_${file.name}`;

        await FileSystem.copyAsync({
          from: file.uri,
          to: tempPath,
        });

        const fileContentBase64 = await FileSystem.readAsStringAsync(tempPath, {
          encoding: FileSystem.EncodingType.Base64,
        });

        processedItems.push({
          originalName: file.name,
          mimeType: file.mimeType,
          data: fileContentBase64,
        });

        await FileSystem.deleteAsync(tempPath, { idempotent: true }).catch(() => {});

        // Actualizar barra de progreso
        setEncryptProgress(Math.round(((i + 1) / total) * 100));
      }

      const payload = JSON.stringify(processedItems);
      const encryptedData = CryptoJS.AES.encrypt(payload, password).toString();

      const outputUri = `${FileSystem.documentDirectory}encrypted_${Date.now()}.enygma`;
      await FileSystem.writeAsStringAsync(outputUri, encryptedData);

      setEncryptedPath(outputUri);
      Alert.alert('OK', i18n.alertSuccessEnc);
    } catch (error: any) {
      Alert.alert('Error', error?.message || 'Encryption failed');
    } finally {
      setIsEncrypting(false);
    }
  };

  const shareFile = async () => {
    if (!encryptedPath) return;

    const isAvailable = await Sharing.isAvailableAsync();
    if (!isAvailable) return;

    await Sharing.shareAsync(encryptedPath, {
      dialogTitle: 'Enygma Crypt File',
      mimeType: 'application/octet-stream',
    });
  };

  const decryptFile = async () => {
    if (!password.trim()) {
      Alert.alert(i18n.alertAttention, i18n.alertPassReq);
      return;
    }

    try {
      const result = await DocumentPicker.getDocumentAsync({ copyToCacheDirectory: true });
      if (result.canceled || !result.assets || !result.assets[0]) return;

      const pickedFile = result.assets[0];
      const encryptedContent = await FileSystem.readAsStringAsync(pickedFile.uri);

      const bytes = CryptoJS.AES.decrypt(encryptedContent, password);
      const decryptedText = bytes.toString(CryptoJS.enc.Utf8);

      if (!decryptedText) {
        Alert.alert('Error', i18n.alertWrongPass);
        return;
      }

      const payload = JSON.parse(decryptedText);

      // Si es un paquete multi-archivo
      if (Array.isArray(payload)) {
        for (const item of payload) {
          const restoredPath = `${FileSystem.cacheDirectory}${item.originalName}`;
          await FileSystem.writeAsStringAsync(restoredPath, item.data, {
            encoding: FileSystem.EncodingType.Base64,
          });
          await Sharing.shareAsync(restoredPath, {
            dialogTitle: item.originalName,
            mimeType: item.mimeType || undefined,
          });
        }
      } else { // Compatibilidad con archivos individuales anteriores
        const restoredPath = `${FileSystem.cacheDirectory}${payload.originalName}`;
        await FileSystem.writeAsStringAsync(restoredPath, payload.data, {
          encoding: FileSystem.EncodingType.Base64,
        });
        await Sharing.shareAsync(restoredPath, {
          dialogTitle: payload.originalName,
          mimeType: payload.mimeType || undefined,
        });
      }
    } catch (error: any) {
      Alert.alert('Error', i18n.alertWrongPass);
    }
  };

  const shareAppInfo = async () => {
    try {
      await Share.share({
        message: i18n.shareInstructionsMsg,
      });
    } catch (error) {
      console.error(error);
    }
  };

  if (!isAuthenticated) {
    return (
      <View style={styles.lockContainer}>
        <Text style={styles.lockTitle}>{i18n.lockTitle}</Text>
        <Text style={styles.lockSubtitle}>{i18n.lockSubtitle}</Text>
        <TouchableOpacity style={styles.unlockButton} onPress={authenticateUser}>
          <Text style={styles.unlockButtonText}>{i18n.unlockBtn}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.scrollContainer}>
      <View style={styles.container}>
        <Text style={styles.title}>{i18n.title}</Text>

        {/* CAMPO CONTRASEÑA Y TUTORIAL */}
        <TextInput
          style={styles.input}
          placeholder={i18n.passPlaceholder}
          placeholderTextColor="#777777"
          secureTextEntry
          value={password}
          onChangeText={setPassword}
        />
        <Text style={styles.helpText}>{i18n.passHelp}</Text>

        <View style={styles.divider} />

        {/* PASO 1 */}
        <View style={styles.section}>
          <View style={styles.buttonRow}>
            <TouchableOpacity style={styles.actionButton} onPress={pickFile}>
              <Text style={styles.actionButtonText}>{i18n.step1}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.actionButton, styles.galleryButton]} onPress={pickImageFromGallery}>
              <Text style={styles.actionButtonText}>{i18n.step1Gallery}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.actionButton, styles.cameraButton]} onPress={takePhotoWithCamera}>
              <Text style={styles.actionButtonText}>{i18n.step1Camera}</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.helpText}>{i18n.step1Help}</Text>
          
          {filesData.length > 0 && (
            <Text style={styles.info}>
              {i18n.selected} {filesData.length} archivo(s) - ({filesData.map(f => f.name).join(', ')})
            </Text>
          )}
        </View>

        <View style={styles.spacer} />

        {/* PASO 2 */}
        <Button
          title={isEncrypting ? `Cifrando (${encryptProgress}%)...` : i18n.step2}
          onPress={encryptFile}
          disabled={filesData.length === 0 || isEncrypting}
          color="#208AEF"
        />

        {/* BARRA DE PROGRESO DE CIFRADO */}
        {isEncrypting && (
          <View style={styles.progressContainer}>
            <View style={[styles.progressBarFill, { width: `${encryptProgress}%` }]} />
          </View>
        )}

        <Text style={styles.helpText}>{i18n.step2Help}</Text>

        <View style={styles.spacer} />

        {/* PASO 3 */}
        <Button
          title={i18n.step3}
          onPress={shareFile}
          disabled={!encryptedPath || isEncrypting}
          color="#2196F3"
        />
        <Text style={styles.helpText}>{i18n.step3Help}</Text>

        <View style={styles.divider} />

        {/* DESENCRIPTAR */}
        <Text style={styles.subtitle}>{i18n.receivedSection}</Text>
        <Button title={i18n.stepDecrypt} onPress={decryptFile} color="#2e7d32" />
        <Text style={styles.helpText}>{i18n.decryptHelp}</Text>

        <View style={styles.divider} />

        {/* COMPARTIR APP E INSTRUCCIONES */}
        <TouchableOpacity style={styles.shareAppButton} onPress={shareAppInfo}>
          <Text style={styles.shareAppButtonText}>{i18n.shareAppBtn}</Text>
        </TouchableOpacity>
        <Text style={styles.helpText}>{i18n.shareAppHelp}</Text>

        <View style={styles.footerContainer}>
          <Text style={styles.footerText}>Enygma Crypt v1.0.0</Text>
          <Text style={styles.footerSubText}>ivangs1975@gmail.com</Text>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scrollContainer: { flexGrow: 1, justifyContent: 'center' },
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20, backgroundColor: '#ffffff' },
  title: { fontSize: 24, fontWeight: 'bold', marginBottom: 15, color: '#208AEF' },
  subtitle: { fontSize: 16, fontWeight: '600', marginBottom: 6, color: '#333333' },
  input: {
    width: '100%',
    borderWidth: 1,
    borderColor: '#cccccc',
    borderRadius: 8,
    padding: 12,
    marginBottom: 6,
    backgroundColor: '#f2f4f8',
    color: '#000000',
    textAlign: 'center',
    fontSize: 16,
  },
  helpText: {
    fontSize: 12,
    color: '#666666',
    textAlign: 'center',
    marginTop: 4,
    marginBottom: 8,
    paddingHorizontal: 10,
  },
  section: { alignItems: 'center', width: '100%' },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    gap: 6,
  },
  actionButton: {
    flex: 1,
    backgroundColor: '#208AEF',
    paddingVertical: 10,
    paddingHorizontal: 4,
    borderRadius: 6,
    alignItems: 'center',
  },
  galleryButton: {
    backgroundColor: '#17a2b8',
  },
  cameraButton: {
    backgroundColor: '#28a745',
  },
  actionButtonText: {
    color: '#ffffff',
    fontWeight: '600',
    fontSize: 12,
  },
  info: { marginTop: 6, color: '#208AEF', fontWeight: 'bold', fontStyle: 'italic', textAlign: 'center' },
  spacer: { marginVertical: 2 },
  divider: { width: '100%', height: 1, backgroundColor: '#e0e0e0', marginVertical: 14 },
  progressContainer: {
    width: '100%',
    height: 8,
    backgroundColor: '#e0e0e0',
    borderRadius: 4,
    overflow: 'hidden',
    marginTop: 8,
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#208AEF',
  },
  shareAppButton: {
    backgroundColor: '#6c757d',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 6,
    marginTop: 4,
  },
  shareAppButtonText: {
    color: '#ffffff',
    fontWeight: '600',
    fontSize: 13,
  },
  footerContainer: {
    marginTop: 20,
    alignItems: 'center',
    justifyContent: 'center',
    opacity: 0.75,
  },
  footerText: {
    color: '#888888',
    fontSize: 12,
    fontWeight: '600',
  },
  footerSubText: {
    color: '#aaaaaa',
    fontSize: 11,
    marginTop: 2,
  },
  lockContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#0d1117',
  },
  lockTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#208AEF',
    marginBottom: 10,
  },
  lockSubtitle: {
    fontSize: 14,
    color: '#8b949e',
    textAlign: 'center',
    marginBottom: 30,
  },
  unlockButton: {
    backgroundColor: '#208AEF',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 8,
  },
  unlockButtonText: {
    color: '#ffffff',
    fontWeight: 'bold',
    fontSize: 15,
  },
});