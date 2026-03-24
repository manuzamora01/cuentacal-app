import React, { useState, useEffect, useMemo } from 'react';
import { StyleSheet, Text, View, ScrollView, TouchableOpacity, Modal, ActivityIndicator, Alert, TextInput, Image } from 'react-native';
import { Plus, X, Camera, Edit3, Activity, Flame, CheckCircle2, Droplets, Trash2, ChevronLeft, ChevronRight } from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import { collection, addDoc, onSnapshot, deleteDoc, doc, query, orderBy } from 'firebase/firestore';
import { db } from '../../firebase'; 

interface FoodItem {
  id: string;
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  time: string;
  imageBase64: string;
  timestamp?: any;
  jsDate?: Date;
}

interface WaterLog {
  id: string;
  amount: number;
  timestamp?: any;
  jsDate?: Date;
}

// 🔑 PON TU API KEY DE GEMINI AQUÍ
const GEMINI_API_KEY = "AIzaSyCeUyNhP-7rnVzMTdjOe4W2WId_ZptYmBE";

const formatCustomDate = (date: Date) => {
  const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
  return `${date.getDate()} ${months[date.getMonth()]}`;
};

export default function HomeScreen() {
  const [isMenuVisible, setIsMenuVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  
  const [foodList, setFoodList] = useState<FoodItem[]>([]);
  const [waterList, setWaterList] = useState<WaterLog[]>([]);
  
  const [pendingFood, setPendingFood] = useState<FoodItem | null>(null);
  
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [weekOffset, setWeekOffset] = useState(0); 

  const [metaCalorias, setMetaCalorias] = useState(2000); 
  const [metaAgua, setMetaAgua] = useState(2500);
  const [streak, setStreak] = useState(0);

  const [textModalVisible, setTextModalVisible] = useState(false);
  const [inputType, setInputType] = useState<'food' | 'exercise'>('food');
  const [inputText, setInputText] = useState('');
  const [savedFoodsVisible, setSavedFoodsVisible] = useState(false);
  const [waterModalVisible, setWaterModalVisible] = useState(false);
  const [waterInput, setWaterInput] = useState('250');

  const weekData = useMemo(() => {
    const today = new Date();
    today.setDate(today.getDate() + (weekOffset * 7));

    const currentDayOfWeek = today.getDay(); 
    const distToMonday = currentDayOfWeek === 0 ? -6 : 1 - currentDayOfWeek;
    const monday = new Date(today);
    monday.setDate(today.getDate() + distToMonday);

    const days = [];
    for (let i = 0; i < 7; i++) {
      const date = new Date(monday);
      date.setDate(monday.getDate() + i);
      days.push({
        letter: ['L', 'M', 'X', 'J', 'V', 'S', 'D'][i],
        dayNumber: date.getDate(),
        fullDate: date,
        isSelected: date.toDateString() === selectedDate.toDateString(),
        isTodayReal: date.toDateString() === new Date().toDateString()
      });
    }

    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    
    let headerText = '';
    if (monday.getMonth() === sunday.getMonth()) {
      headerText = `${monday.getDate()} - ${formatCustomDate(sunday)}`;
    } else {
      headerText = `${formatCustomDate(monday)} - ${formatCustomDate(sunday)}`;
    }

    return { days, headerText };
  }, [selectedDate, weekOffset]); 

  useEffect(() => {
    // ✅ Escucha en tiempo real de tu perfil para actualizar calorías y agua al instante
    const unsubProfile = onSnapshot(doc(db, "usuarios", "mi_perfil"), (docSnap) => {
      if (docSnap.exists()) {
        setMetaCalorias(docSnap.data().metaCalorias || 2000);
        setMetaAgua(docSnap.data().metaAgua || 2500);
      }
    });

    const qComidas = query(collection(db, "comidas"), orderBy("timestamp", "desc"));
    const unsubComidas = onSnapshot(qComidas, (snapshot) => {
      setFoodList(snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id, jsDate: doc.data().timestamp?.toDate ? doc.data().timestamp.toDate() : new Date() })) as FoodItem[]);
    });

    const qAgua = query(collection(db, "agua"), orderBy("timestamp", "desc"));
    const unsubAgua = onSnapshot(qAgua, (snapshot) => {
      setWaterList(snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id, jsDate: doc.data().timestamp?.toDate ? doc.data().timestamp.toDate() : new Date() })) as WaterLog[]);
    });

    return () => { unsubProfile(); unsubComidas(); unsubAgua(); }; 
  }, []);

  useEffect(() => {
    const allDates = new Set([
      ...foodList.map(f => f.jsDate?.toDateString()),
      ...waterList.map(w => w.jsDate?.toDateString())
    ]);

    let currentStreak = 0;
    let checkDate = new Date();
    
    if (allDates.has(checkDate.toDateString())) {
      currentStreak++;
      checkDate.setDate(checkDate.getDate() - 1);
    } else {
      checkDate.setDate(checkDate.getDate() - 1);
      if (allDates.has(checkDate.toDateString())) {
        currentStreak++;
        checkDate.setDate(checkDate.getDate() - 1);
      } else {
        setStreak(0);
        return;
      }
    }
    while (allDates.has(checkDate.toDateString())) {
      currentStreak++;
      checkDate.setDate(checkDate.getDate() - 1);
    }
    setStreak(currentStreak);
  }, [foodList, waterList]);

  const uniqueSavedFoods = Array.from(new Map(foodList.filter(f => f.calories > 0).map(item => [item.name, item])).values());

  const dailyFoods = foodList.filter(food => food.jsDate && food.jsDate.toDateString() === selectedDate.toDateString());
  const dailyWaterLogs = waterList.filter(water => water.jsDate && water.jsDate.toDateString() === selectedDate.toDateString());

  const totalCalories = dailyFoods.reduce((sum, item) => sum + item.calories, 0);
  const totalProtein = dailyFoods.reduce((sum, item) => sum + item.protein, 0);
  const totalCarbs = dailyFoods.reduce((sum, item) => sum + item.carbs, 0);
  const totalFat = dailyFoods.reduce((sum, item) => sum + item.fat, 0);
  const totalWater = dailyWaterLogs.reduce((sum, item) => sum + item.amount, 0);

  const metaProteina = Math.round((metaCalorias * 0.3) / 4);
  const metaHidratos = Math.round((metaCalorias * 0.4) / 4);
  const metaGrasas = Math.round((metaCalorias * 0.3) / 9);

  const analyzeWithGemini = async (inputData: string, type: 'image' | 'food' | 'exercise') => {
    setLoading(true);
    try {
      const cleanApiKey = GEMINI_API_KEY.trim();
      let prompt = ""; let payloadContents: any[] = [];

      if (type === 'image') {
        prompt = `Analiza esta imagen. Devuelve ESTRICTAMENTE un JSON válido: {"food_name": "Nombre", "calories": número, "protein": número, "carbs": número, "fat": número}`;
        payloadContents = [{ parts: [{ text: prompt }, { inlineData: { mimeType: "image/jpeg", data: inputData } }] }];
      } else if (type === 'food') {
        prompt = `Calcula macros aproximados para: "${inputData}". Devuelve JSON: {"food_name": "Nombre", "calories": número, "protein": número, "carbs": número, "fat": número}`;
        payloadContents = [{ parts: [{ text: prompt }] }];
      } else if (type === 'exercise') {
        prompt = `Calcula calorías quemadas por: "${inputData}". Devuelve JSON: {"food_name": "🏃‍♂️ Nombre ejercicio", "calories": número NEGATIVO, "protein": 0, "carbs": 0, "fat": 0}`;
        payloadContents = [{ parts: [{ text: prompt }] }];
      }
      
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${cleanApiKey}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: payloadContents })
      });
      
      if (!response.ok) throw new Error(`Error HTTP ${response.status}`);
      const jsonResponse = await response.json();
      let text = jsonResponse.candidates[0].content.parts[0].text.replace(/```json/g, '').replace(/```/g, '').trim();
      const macros = JSON.parse(text);
      
      setPendingFood({
        id: '', name: macros.food_name, calories: macros.calories, protein: macros.protein, carbs: macros.carbs, fat: macros.fat,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), imageBase64: type === 'image' ? inputData : '' 
      });
    } catch (error: any) { Alert.alert("Error de IA", "No pudimos analizar la información."); } finally { setLoading(false); }
  };

  const handleScanMenu = () => {
    setIsMenuVisible(false);
    Alert.alert("Escanear alimento", "¿De dónde quieres obtener la imagen?", [
      { text: "Cancelar", style: "cancel" },
      { text: "Cámara", onPress: takePhoto },
      { text: "Galería", onPress: pickImageFromGallery }
    ]);
  };

  const takePhoto = async () => {
    const permissionResult = await ImagePicker.requestCameraPermissionsAsync();
    if (permissionResult.granted === false) return;
    let result = await ImagePicker.launchCameraAsync({ allowsEditing: true, aspect: [4, 3], quality: 0.1, base64: true });
    if (!result.canceled && result.assets && result.assets[0].base64) analyzeWithGemini(result.assets[0].base64, 'image');
  };

  const pickImageFromGallery = async () => {
    let result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, allowsEditing: true, aspect: [4, 3], quality: 0.1, base64: true });
    if (!result.canceled && result.assets && result.assets[0].base64) analyzeWithGemini(result.assets[0].base64, 'image');
  };

  const openTextModal = (type: 'food' | 'exercise') => {
    setIsMenuVisible(false);
    setInputType(type);
    setInputText('');
    setTextModalVisible(true);
  };

  const handleTextSubmit = () => {
    if (!inputText.trim()) return;
    setTextModalVisible(false);
    analyzeWithGemini(inputText, inputType);
  };

  const confirmAndSaveFood = async () => {
    if (pendingFood) {
      try {
        await addDoc(collection(db, "comidas"), { ...pendingFood, timestamp: new Date() });
        setPendingFood(null); setSelectedDate(new Date()); 
      } catch (error: any) { Alert.alert("Error", error.message); }
    }
  };

  const quickAddFood = async (food: FoodItem) => {
    setSavedFoodsVisible(false);
    try {
      await addDoc(collection(db, "comidas"), { ...food, time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), timestamp: new Date() });
      setSelectedDate(new Date());
    } catch (error: any) { Alert.alert("Error", "No se pudo añadir."); }
  };

  const deleteFood = (id: string, name: string) => {
    Alert.alert("Borrar", `¿Eliminar ${name}?`, [
      { text: "Cancelar", style: "cancel" },
      { text: "Borrar", style: "destructive", onPress: async () => {
          try { await deleteDoc(doc(db, "comidas", id)); } 
          catch(e: any) { Alert.alert("Error", "No se pudo borrar"); }
      }}
    ]);
  };

  const saveCustomWater = async () => {
    const amount = parseInt(waterInput);
    if (isNaN(amount) || amount <= 0) {
      Alert.alert("Error", "Por favor, introduce una cantidad válida.");
      return;
    }
    try {
      await addDoc(collection(db, "agua"), { amount, timestamp: new Date() });
      setWaterModalVisible(false);
      setSelectedDate(new Date());
    } catch (error) { Alert.alert("Error", "No se pudo registrar."); }
  };

  const undoLastWater = async () => {
    if (dailyWaterLogs.length === 0) return;
    const lastLog = dailyWaterLogs[0]; 
    try {
      await deleteDoc(doc(db, "agua", lastLog.id));
      setWaterModalVisible(false);
    } catch (e) { Alert.alert("Error", "No se pudo deshacer."); }
  };

  return (
    <View style={styles.mainContainer}>
      <ScrollView contentContainerStyle={styles.scrollContainer} showsVerticalScrollIndicator={false}>
        
        <View style={styles.header}>
          <Text style={styles.logoText}>🍏 CuentaCal</Text>
          <View style={styles.fireBadge}>
            <Flame size={16} color="#0047AB" fill="#0047AB" style={{marginRight: 4}} />
            <Text style={styles.fireText}>{streak}</Text>
          </View>
        </View>

        <View style={styles.calendarHeaderRow}>
          <TouchableOpacity onPress={() => setWeekOffset(prev => prev - 1)} style={styles.navBtn}>
             <ChevronLeft size={20} color="#0047AB" />
          </TouchableOpacity>
          <Text style={styles.calendarHeaderText}>{weekData.headerText}</Text>
          <TouchableOpacity onPress={() => setWeekOffset(prev => prev + 1)} style={styles.navBtn}>
             <ChevronRight size={20} color="#0047AB" />
          </TouchableOpacity>
        </View>

        <View style={styles.calendarRow}>
          {weekData.days.map((day, index) => (
             <TouchableOpacity key={index} style={styles.calendarDay} onPress={() => setSelectedDate(day.fullDate)}>
               <Text style={[styles.calendarDayText, day.isTodayReal && {color: '#0047AB', fontWeight: 'bold'}]}>{day.letter}</Text>
               <View style={[styles.calendarCircle, day.isSelected && styles.calendarCircleActive]}>
                 <Text style={[styles.calendarDateText, day.isSelected && styles.calendarDateTextActive]}>{day.dayNumber}</Text>
               </View>
             </TouchableOpacity>
          ))}
        </View>

        <View style={styles.card}>
          <View style={styles.caloriesMainRow}>
            <View>
              <Text style={styles.caloriesNumber}>{totalCalories}<Text style={styles.caloriesTotal}> /{metaCalorias}</Text></Text>
              <Text style={styles.caloriesLabel}>Calorías consumidas</Text>
            </View>
            <View style={styles.blueRing}>
              <Flame size={24} color="#0047AB" />
            </View>
          </View>
        </View>

        <View style={styles.macrosContainer}>
          <View style={styles.macroCard}>
            <Text style={styles.macroNumber}>{totalProtein}<Text style={styles.macroTotal}>/{metaProteina}g</Text></Text>
            <Text style={styles.macroLabel}>Proteína</Text>
            <View style={[styles.macroRing, { borderColor: '#0047AB' }]} />
          </View>
          <View style={styles.macroCard}>
            <Text style={styles.macroNumber}>{totalCarbs}<Text style={styles.macroTotal}>/{metaHidratos}g</Text></Text>
            <Text style={styles.macroLabel}>Hidratos</Text>
            <View style={[styles.macroRing, { borderColor: '#4C8BF5' }]} />
          </View>
          <View style={styles.macroCard}>
            <Text style={styles.macroNumber}>{totalFat}<Text style={styles.macroTotal}>/{metaGrasas}g</Text></Text>
            <Text style={styles.macroLabel}>Grasas</Text>
            <View style={[styles.macroRing, { borderColor: '#99BADD' }]} />
          </View>
        </View>

        <View style={styles.waterCard}>
          <View style={styles.waterInfo}>
            <Droplets size={28} color="#4C8BF5" />
            <View style={{marginLeft: 15}}>
              <Text style={styles.waterTitle}>Agua consumida</Text>
              <Text style={styles.waterText}>{totalWater} <Text style={styles.waterTotal}>/ {metaAgua} ml</Text></Text>
            </View>
          </View>
          <TouchableOpacity style={styles.waterBtn} onPress={() => { setWaterInput('250'); setWaterModalVisible(true); }}>
            <Plus size={20} color="#FFFFFF" />
            <Text style={styles.waterBtnText}>Añadir</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.sectionTitle}>{selectedDate.toDateString() === new Date().toDateString() ? "Subido hoy" : "Registro del día"}</Text>
        
        {dailyFoods.length === 0 ? (
          <Text style={{color: '#6699CC', textAlign: 'center', marginTop: 20}}>No hay registros para este día.</Text>
        ) : (
          dailyFoods.map((food) => (
            <View key={food.id} style={styles.recentItem}>
              {food.imageBase64 ? <Image source={{ uri: `data:image/jpeg;base64,${food.imageBase64}` }} style={styles.recentImagePlaceholder} /> : <View style={styles.recentImagePlaceholder} />}
              <View style={styles.recentDetails}>
                <View style={styles.recentHeaderRow}>
                  <Text style={styles.recentName}>{food.name}</Text>
                  <Text style={styles.recentTime}>{food.time}</Text>
                </View>
                <Text style={[styles.recentCals, food.calories < 0 && {color: '#28A745'}]}>
                  {food.calories < 0 ? `🏃‍♂️ ${food.calories} cal` : `🔥 ${food.calories} cal`}
                </Text>
                <View style={styles.recentMacrosRow}>
                  <Text style={styles.recentMacroText}>🥩 {food.protein}g  🍞 {food.carbs}g  🥑 {food.fat}g</Text>
                </View>
              </View>
              <TouchableOpacity onPress={() => deleteFood(food.id, food.name)} style={styles.deleteButton}>
                <Trash2 size={24} color="#FF6B6B" />
              </TouchableOpacity>
            </View>
          ))
        )}
      </ScrollView>

      {loading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="#0047AB" />
          <Text style={styles.loadingText}>Analizando con IA...</Text>
        </View>
      )}

      {/* MODALES */}
      <Modal visible={!!pendingFood} transparent={true} animationType="slide">
        <View style={styles.editModalOverlay}>
          <View style={styles.editModalContent}>
            <Text style={styles.editTitle}>Revisa los datos</Text>
            <Text style={styles.inputLabel}>Nombre del alimento/ejercicio</Text>
            <TextInput style={styles.inputField} value={pendingFood?.name} onChangeText={(t) => setPendingFood(prev => prev ? {...prev, name: t} : null)} />
            <View style={styles.editRow}>
              <View style={styles.editColumn}>
                <Text style={styles.inputLabel}>Calorías</Text>
                <TextInput style={styles.inputField} keyboardType="numeric" value={pendingFood?.calories.toString()} onChangeText={(t) => setPendingFood(prev => prev ? {...prev, calories: Number(t)} : null)} />
              </View>
              <View style={styles.editColumn}>
                <Text style={styles.inputLabel}>Proteínas (g)</Text>
                <TextInput style={styles.inputField} keyboardType="numeric" value={pendingFood?.protein.toString()} onChangeText={(t) => setPendingFood(prev => prev ? {...prev, protein: Number(t)} : null)} />
              </View>
            </View>
            <View style={styles.editRow}>
              <View style={styles.editColumn}>
                <Text style={styles.inputLabel}>Hidratos (g)</Text>
                <TextInput style={styles.inputField} keyboardType="numeric" value={pendingFood?.carbs.toString()} onChangeText={(t) => setPendingFood(prev => prev ? {...prev, carbs: Number(t)} : null)} />
              </View>
              <View style={styles.editColumn}>
                <Text style={styles.inputLabel}>Grasas (g)</Text>
                <TextInput style={styles.inputField} keyboardType="numeric" value={pendingFood?.fat.toString()} onChangeText={(t) => setPendingFood(prev => prev ? {...prev, fat: Number(t)} : null)} />
              </View>
            </View>
            <View style={styles.editButtonsRow}>
              <TouchableOpacity style={styles.cancelButton} onPress={() => setPendingFood(null)}><Text style={styles.cancelButtonText}>Cancelar</Text></TouchableOpacity>
              <TouchableOpacity style={styles.saveButton} onPress={confirmAndSaveFood}><Text style={styles.saveButtonText}>Guardar</Text></TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={textModalVisible} transparent={true} animationType="fade">
        <View style={styles.editModalOverlay}>
          <View style={styles.editModalContent}>
            <Text style={styles.editTitle}>{inputType === 'food' ? 'Buscar Alimento' : 'Registrar Ejercicio'}</Text>
            <Text style={styles.inputLabel}>{inputType === 'food' ? 'Ej: Plato de lentejas' : 'Ej: Corrí durante 45 minutos'}</Text>
            <TextInput style={[styles.inputField, { height: 100, textAlignVertical: 'top' }]} multiline={true} placeholder="Escribe aquí..." value={inputText} onChangeText={setInputText} />
            <View style={styles.editButtonsRow}>
              <TouchableOpacity style={styles.cancelButton} onPress={() => setTextModalVisible(false)}><Text style={styles.cancelButtonText}>Cancelar</Text></TouchableOpacity>
              <TouchableOpacity style={styles.saveButton} onPress={handleTextSubmit}><Text style={styles.saveButtonText}>Analizar</Text></TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={waterModalVisible} transparent={true} animationType="fade">
        <View style={styles.editModalOverlay}>
          <View style={styles.editModalContent}>
            <Text style={styles.editTitle}>Añadir Agua</Text>
            <Text style={styles.inputLabel}>Cantidad (ml)</Text>
            <TextInput style={styles.inputField} keyboardType="numeric" value={waterInput} onChangeText={setWaterInput} autoFocus={true} />
            <View style={styles.editButtonsRow}>
              <TouchableOpacity style={styles.cancelButton} onPress={() => setWaterModalVisible(false)}><Text style={styles.cancelButtonText}>Cancelar</Text></TouchableOpacity>
              <TouchableOpacity style={styles.saveButton} onPress={saveCustomWater}><Text style={styles.saveButtonText}>Guardar</Text></TouchableOpacity>
            </View>
            {dailyWaterLogs.length > 0 && (
              <TouchableOpacity style={{marginTop: 20, alignItems: 'center'}} onPress={undoLastWater}>
                <Text style={{color: '#FF6B6B', fontWeight: 'bold', fontSize: 14}}>Deshacer último registro</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </Modal>

      <Modal visible={savedFoodsVisible} transparent={true} animationType="slide">
        <View style={styles.editModalOverlay}>
          <View style={styles.editModalContent}>
            <View style={styles.recentHeaderRow}>
              <Text style={styles.editTitle}>Tus Alimentos</Text>
              <TouchableOpacity onPress={() => setSavedFoodsVisible(false)}><X size={24} color="#003366" /></TouchableOpacity>
            </View>
            <ScrollView style={{maxHeight: 400}}>
              {uniqueSavedFoods.map((food, index) => (
                <TouchableOpacity key={index} style={styles.recentItem} onPress={() => quickAddFood(food)}>
                  <View style={styles.recentDetails}>
                    <Text style={styles.recentName}>{food.name}</Text>
                    <Text style={styles.recentCals}>🔥 {food.calories} cal</Text>
                  </View>
                  <Plus size={24} color="#0047AB" />
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {!isMenuVisible && (
        <TouchableOpacity style={styles.fab} onPress={() => setIsMenuVisible(true)}>
          <Plus size={32} color="#FFFFFF" />
        </TouchableOpacity>
      )}

      <Modal visible={isMenuVisible} transparent={true} animationType="fade">
        <View style={styles.darkModalOverlay}>
          <TouchableOpacity style={{flex: 1}} onPress={() => setIsMenuVisible(false)} />
          <View style={styles.gridContainer}>
            <TouchableOpacity style={styles.gridBox} onPress={() => openTextModal('exercise')}><Activity size={32} color="#000" /><Text style={styles.gridBoxText}>Registrar ejercicio</Text></TouchableOpacity>
            <TouchableOpacity style={styles.gridBox} onPress={() => { setIsMenuVisible(false); setSavedFoodsVisible(true); }}><CheckCircle2 size={32} color="#000" /><Text style={styles.gridBoxText}>Alimentos guardados</Text></TouchableOpacity>
            <TouchableOpacity style={styles.gridBox} onPress={() => openTextModal('food')}><Edit3 size={32} color="#000" /><Text style={styles.gridBoxText}>Base de datos de ali...</Text></TouchableOpacity>
            <TouchableOpacity style={styles.gridBox} onPress={handleScanMenu}><Camera size={32} color="#000" /><Text style={styles.gridBoxText}>Escanear alimento</Text></TouchableOpacity>
          </View>
          <TouchableOpacity style={styles.closeFabDark} onPress={() => setIsMenuVisible(false)}><X size={32} color="#FFFFFF" /></TouchableOpacity>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  mainContainer: { flex: 1, backgroundColor: '#F0F8FF' }, 
  scrollContainer: { padding: 20, paddingTop: 50, paddingBottom: 100 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 },
  logoText: { fontSize: 28, fontWeight: '900', color: '#003366' },
  fireBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: '#E6F0FA' },
  fireText: { fontSize: 16, fontWeight: 'bold', color: '#0047AB' },
  calendarHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, paddingHorizontal: 10 },
  calendarHeaderText: { fontSize: 16, fontWeight: 'bold', color: '#003366' },
  navBtn: { padding: 5, backgroundColor: '#FFFFFF', borderRadius: 10, borderWidth: 1, borderColor: '#E6F0FA' },
  calendarRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 25 },
  calendarDay: { alignItems: 'center' },
  calendarDayText: { fontSize: 12, color: '#6699CC', marginBottom: 5, fontWeight: '600' },
  calendarCircle: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center', backgroundColor: 'transparent' },
  calendarCircleActive: { backgroundColor: '#FFFFFF', borderWidth: 2, borderColor: '#0047AB' },
  calendarDateText: { fontSize: 16, fontWeight: '600', color: '#003366' },
  calendarDateTextActive: { fontWeight: '900', color: '#0047AB' },
  card: { backgroundColor: '#FFFFFF', borderRadius: 24, padding: 20, marginBottom: 15, borderWidth: 1, borderColor: '#B3D4FF' },
  caloriesMainRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  caloriesNumber: { fontSize: 36, fontWeight: '900', color: '#003366' },
  caloriesTotal: { fontSize: 18, color: '#6699CC', fontWeight: '600' },
  caloriesLabel: { fontSize: 14, color: '#6699CC', marginTop: 5, fontWeight: '500' },
  blueRing: { width: 80, height: 80, borderRadius: 40, borderWidth: 8, borderColor: '#0047AB', justifyContent: 'center', alignItems: 'center' },
  macrosContainer: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 },
  macroCard: { backgroundColor: '#FFFFFF', borderRadius: 20, padding: 15, width: '31%', alignItems: 'center', borderWidth: 1, borderColor: '#E6F0FA' },
  macroNumber: { fontSize: 18, fontWeight: '900', color: '#003366' },
  macroTotal: { fontSize: 12, color: '#6699CC' },
  macroLabel: { fontSize: 10, color: '#6699CC', marginBottom: 15, textAlign: 'center', marginTop: 2 },
  macroRing: { width: 45, height: 45, borderRadius: 22.5, borderWidth: 6 },
  waterCard: { backgroundColor: '#FFFFFF', borderRadius: 20, padding: 20, marginBottom: 30, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderWidth: 1, borderColor: '#B3D4FF' },
  waterInfo: { flexDirection: 'row', alignItems: 'center' },
  waterTitle: { fontSize: 14, color: '#6699CC', fontWeight: 'bold' },
  waterText: { fontSize: 24, fontWeight: '900', color: '#003366' },
  waterTotal: { fontSize: 14, color: '#6699CC', fontWeight: '600' },
  waterBtn: { backgroundColor: '#4C8BF5', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 10, borderRadius: 16 },
  waterBtnText: { color: '#FFFFFF', fontWeight: 'bold', marginLeft: 4 },
  sectionTitle: { fontSize: 22, fontWeight: '900', color: '#003366', marginBottom: 15 },
  recentItem: { backgroundColor: '#FFFFFF', borderRadius: 20, padding: 15, flexDirection: 'row', alignItems: 'center', marginBottom: 10, borderWidth: 1, borderColor: '#E6F0FA' },
  recentImagePlaceholder: { width: 70, height: 70, backgroundColor: '#E6F0FA', borderRadius: 16, marginRight: 15 },
  recentDetails: { flex: 1 },
  recentHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  recentName: { fontSize: 16, fontWeight: 'bold', color: '#003366', textTransform: 'capitalize' },
  recentTime: { fontSize: 12, color: '#6699CC' },
  recentCals: { fontSize: 15, color: '#0047AB', marginTop: 4, fontWeight: '800' },
  recentMacrosRow: { marginTop: 6 },
  recentMacroText: { fontSize: 12, color: '#6699CC', fontWeight: '500' },
  deleteButton: { padding: 10 },
  fab: { position: 'absolute', bottom: 20, right: 20, backgroundColor: '#0047AB', width: 64, height: 64, borderRadius: 32, justifyContent: 'center', alignItems: 'center', elevation: 5 },
  loadingOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(255, 255, 255, 0.9)', justifyContent: 'center', alignItems: 'center', zIndex: 10 },
  loadingText: { marginTop: 15, fontSize: 16, fontWeight: 'bold', color: '#0047AB' },
  editModalOverlay: { flex: 1, backgroundColor: 'rgba(0, 51, 102, 0.6)', justifyContent: 'center', padding: 20 },
  editModalContent: { backgroundColor: '#FFFFFF', borderRadius: 24, padding: 25, borderWidth: 1, borderColor: '#B3D4FF' },
  editTitle: { fontSize: 22, fontWeight: '900', color: '#003366', marginBottom: 20, textAlign: 'center' },
  inputLabel: { fontSize: 12, color: '#6699CC', marginBottom: 5, fontWeight: 'bold' },
  inputField: { backgroundColor: '#F0F8FF', borderWidth: 1, borderColor: '#B3D4FF', borderRadius: 12, padding: 12, fontSize: 16, color: '#003366', marginBottom: 15 },
  editRow: { flexDirection: 'row', justifyContent: 'space-between' },
  editColumn: { width: '48%' },
  editButtonsRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 10 },
  cancelButton: { paddingVertical: 15, width: '48%', borderRadius: 12, backgroundColor: '#E6F0FA', alignItems: 'center' },
  cancelButtonText: { color: '#0047AB', fontWeight: 'bold', fontSize: 16 },
  saveButton: { paddingVertical: 15, width: '48%', borderRadius: 12, backgroundColor: '#0047AB', alignItems: 'center' },
  saveButtonText: { color: '#FFFFFF', fontWeight: 'bold', fontSize: 16 },
  darkModalOverlay: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.75)', justifyContent: 'flex-end' },
  gridContainer: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', paddingHorizontal: 20, paddingBottom: 110 },
  gridBox: { backgroundColor: '#FFFFFF', width: '47%', aspectRatio: 1, borderRadius: 28, justifyContent: 'center', alignItems: 'center', marginBottom: 16, padding: 15 },
  gridBoxText: { fontSize: 15, fontWeight: '800', color: '#000000', textAlign: 'center', marginTop: 12 },
  closeFabDark: { position: 'absolute', bottom: 20, right: 20, backgroundColor: '#1C1C1E', width: 64, height: 64, borderRadius: 32, justifyContent: 'center', alignItems: 'center' }
});