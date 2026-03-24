import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, ScrollView, TouchableOpacity, Modal, TextInput, Alert, ActivityIndicator } from 'react-native';
import { User, Target, Activity, Edit3, Scale, Flame, Droplets, ChevronRight, X, TrendingDown } from 'lucide-react-native';
import { doc, getDoc, setDoc, collection, addDoc, onSnapshot, query, orderBy, updateDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../../firebase';

export default function ProfileScreen() {
  const [loading, setLoading] = useState(true);
  const [profileModalVisible, setProfileModalVisible] = useState(false);
  const [weightModalVisible, setWeightModalVisible] = useState(false);
  const [newWeight, setNewWeight] = useState('');
  const [weightHistory, setWeightHistory] = useState<any[]>([]);

  const defaultProfile = {
    gender: 'male', 
    age: 25,
    height: 175,
    currentWeight: 75,
    targetWeight: 70,
    weeksToGoal: 10,
    activityLevel: 'mod', 
    metaCalorias: 2000,
    metaAgua: 2500,
    startWeight: 75 
  };

  const [userData, setUserData] = useState(defaultProfile);
  const [form, setForm] = useState(defaultProfile);

  useEffect(() => {
    const loadProfile = async () => {
      const docRef = doc(db, "usuarios", "mi_perfil");
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const dbData = docSnap.data();
        const mergedData = { 
          gender: dbData.gender || 'male',
          age: dbData.age || 25,
          height: dbData.height || 175,
          currentWeight: dbData.currentWeight || 75,
          targetWeight: dbData.targetWeight || 70,
          weeksToGoal: dbData.weeksToGoal || 10,
          activityLevel: dbData.activityLevel || 'mod',
          metaCalorias: dbData.metaCalorias || 2000,
          metaAgua: dbData.metaAgua || 2500,
          startWeight: dbData.startWeight || dbData.currentWeight || 75
        };
        setUserData(mergedData);
        setForm(mergedData);
      } else {
        await setDoc(docRef, defaultProfile);
      }
      setLoading(false);
    };
    loadProfile();

    const q = query(collection(db, "usuarios/mi_perfil/historial_peso"), orderBy("date", "desc"));
    const unsub = onSnapshot(q, (snapshot) => {
      setWeightHistory(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    return () => unsub();
  }, []);

  const calculateTargets = (data: any) => {
    let bmr = (10 * data.currentWeight) + (6.25 * data.height) - (5 * data.age);
    bmr += data.gender === 'male' ? 5 : -161;

    const multipliers: any = { sed: 1.2, light: 1.375, mod: 1.55, active: 1.725 };
    const tdee = bmr * multipliers[data.activityLevel];

    let dailyAdjustment = 0;
    if (data.targetWeight !== data.currentWeight && data.weeksToGoal > 0) {
      const diffKg = data.targetWeight - data.currentWeight;
      const totalKcalDiff = diffKg * 7700;
      dailyAdjustment = totalKcalDiff / (data.weeksToGoal * 7);
    }

    let targetCals = Math.round(tdee + dailyAdjustment);

    if (data.gender === 'male' && targetCals < 1500) targetCals = 1500;
    if (data.gender === 'female' && targetCals < 1200) targetCals = 1200;

    const targetWater = Math.round(data.currentWeight * 35);

    return { metaCalorias: targetCals, metaAgua: targetWater };
  };

  const saveProfile = async () => {
    const newTargets = calculateTargets(form);
    const finalData = { ...form, ...newTargets };
    
    if (!userData.startWeight || form.currentWeight !== userData.currentWeight) {
        if(form.targetWeight !== userData.targetWeight) {
            finalData.startWeight = form.currentWeight;
        }
    }

    try {
      await setDoc(doc(db, "usuarios", "mi_perfil"), finalData);
      setUserData(finalData);
      setProfileModalVisible(false);
      Alert.alert("¡Perfil Actualizado!", "Tus metas calóricas se han reajustado a tu nuevo objetivo.");
    } catch (e) {
      Alert.alert("Error", "No se pudo guardar el perfil.");
    }
  };

  const logNewWeight = async () => {
    const weight = parseFloat(newWeight);
    if (isNaN(weight) || weight <= 0) {
      Alert.alert("Error", "Introduce un peso válido.");
      return;
    }

    const updatedData = { ...userData, currentWeight: weight };
    const newTargets = calculateTargets(updatedData);
    const finalData = { ...updatedData, ...newTargets };

    try {
      const todayString = new Date().toDateString();
      const existingEntry = weightHistory.find(log => {
        const logDate = log.date?.toDate ? log.date.toDate() : new Date(log.date);
        return logDate.toDateString() === todayString;
      });

      if (existingEntry) {
        await updateDoc(doc(db, "usuarios/mi_perfil/historial_peso", existingEntry.id), { weight: weight });
      } else {
        await addDoc(collection(db, "usuarios/mi_perfil/historial_peso"), { weight: weight, date: new Date() });
      }

      await setDoc(doc(db, "usuarios", "mi_perfil"), finalData);
      
      setUserData(finalData);
      setForm(finalData);
      setWeightModalVisible(false);
      setNewWeight('');
    } catch (error) {
      Alert.alert("Error", "No se guardó el peso.");
    }
  };

  const deleteWeightPrompt = (id: string, weight: number) => {
    Alert.alert(
      "Borrar registro", 
      `¿Quieres eliminar el pesaje de ${weight} kg?`, 
      [
        { text: "Cancelar", style: "cancel" },
        { text: "Borrar", style: "destructive", onPress: async () => {
            try {
              await deleteDoc(doc(db, "usuarios/mi_perfil/historial_peso", id));
              
              if (weightHistory.length > 1 && weightHistory[0].id === id) {
                const previousWeight = weightHistory[1].weight;
                const updatedData = { ...userData, currentWeight: previousWeight };
                const newTargets = calculateTargets(updatedData);
                const finalData = { ...updatedData, ...newTargets };
                
                await setDoc(doc(db, "usuarios", "mi_perfil"), finalData);
                setUserData(finalData);
                setForm(finalData);
              }
            } catch(e) { 
              Alert.alert("Error", "No se pudo borrar el registro."); 
            }
        }}
      ]
    );
  };

  const imc = (userData.currentWeight / Math.pow(userData.height / 100, 2)).toFixed(1);
  let imcStatus = "Normal";
  let imcColor = "#28A745"; 
  if (Number(imc) < 18.5) { imcStatus = "Bajo peso"; imcColor = "#4C8BF5"; }
  else if (Number(imc) >= 25 && Number(imc) < 30) { imcStatus = "Sobrepeso"; imcColor = "#FFB020"; }
  else if (Number(imc) >= 30) { imcStatus = "Obesidad"; imcColor = "#FF6B6B"; }

  const weightDiff = userData.currentWeight - userData.targetWeight;
  const isGoalReached = (userData.startWeight > userData.targetWeight && userData.currentWeight <= userData.targetWeight) || 
                        (userData.startWeight < userData.targetWeight && userData.currentWeight >= userData.targetWeight);
  
  const totalDiff = Math.abs(userData.startWeight - userData.targetWeight);
  const currentDiff = Math.abs(userData.currentWeight - userData.targetWeight);
  let progressPercent = totalDiff === 0 ? 100 : Math.max(0, Math.min(100, ((totalDiff - currentDiff) / totalDiff) * 100));
  if (isGoalReached) progressPercent = 100;

  const chartData = [...weightHistory].slice(0, 7).reverse();
  const maxChartWeight = chartData.length > 0 ? Math.max(...chartData.map(d => d.weight), userData.targetWeight) + 1 : 0;
  const minChartWeight = chartData.length > 0 ? Math.min(...chartData.map(d => d.weight), userData.targetWeight) - 1 : 0;
  const chartRange = maxChartWeight - minChartWeight;

  const formatDateShort = (dateObj: any) => {
    if (!dateObj) return '';
    const d = dateObj.toDate ? dateObj.toDate() : new Date(dateObj);
    return `${d.getDate()}/${d.getMonth()+1}`;
  };

  if (loading) {
    return <View style={styles.loadingContainer}><ActivityIndicator size="large" color="#0047AB" /></View>;
  }

  return (
    <ScrollView style={styles.mainContainer} contentContainerStyle={{paddingBottom: 100}} showsVerticalScrollIndicator={false}>
      
      <View style={styles.header}>
        <View style={styles.profileInfo}>
          <View style={styles.avatar}><User size={40} color="#0047AB" /></View>
          <View>
            <Text style={styles.nameText}>Tu Perfil Físico</Text>
            <Text style={styles.subtitleText}>{userData.age} años • {userData.height} cm</Text>
          </View>
        </View>
        <TouchableOpacity style={styles.editBtn} onPress={() => setProfileModalVisible(true)}>
          <Edit3 size={20} color="#0047AB" />
        </TouchableOpacity>
      </View>

      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Target size={24} color="#003366" />
          <Text style={styles.cardTitle}>Progreso de Objetivo</Text>
        </View>
        
        <View style={styles.weightRow}>
          <View style={styles.weightBox}>
            <Text style={styles.weightLabel}>Actual</Text>
            <Text style={styles.weightValue}>{userData.currentWeight}<Text style={styles.weightUnit}> kg</Text></Text>
          </View>
          <ChevronRight size={24} color="#B3D4FF" />
          <View style={styles.weightBox}>
            <Text style={styles.weightLabel}>Objetivo</Text>
            <Text style={styles.weightValue}>{userData.targetWeight}<Text style={styles.weightUnit}> kg</Text></Text>
          </View>
        </View>

        <View style={styles.progressBarBg}>
          <View style={[styles.progressBarFill, {width: `${progressPercent}%`}]} />
        </View>
        <Text style={styles.progressText}>
          {isGoalReached ? "¡Objetivo cumplido! 🎉" : `Faltan ${Math.abs(weightDiff).toFixed(1)} kg para tu meta`}
        </Text>

        <TouchableOpacity style={styles.logWeightBtn} onPress={() => setWeightModalVisible(true)}>
          <Scale size={20} color="#FFFFFF" />
          <Text style={styles.logWeightBtnText}>Registrar peso de hoy</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.sectionTitle}>Tus Requerimientos</Text>
      <View style={styles.statsGrid}>
        <View style={styles.statBox}>
          <Flame size={28} color="#0047AB" />
          <Text style={styles.statNumber}>{userData.metaCalorias}</Text>
          <Text style={styles.statDesc}>Kcal diarias</Text>
        </View>
        <View style={styles.statBox}>
          <Droplets size={28} color="#4C8BF5" />
          <Text style={styles.statNumber}>{userData.metaAgua / 1000}L</Text>
          <Text style={styles.statDesc}>Agua diaria</Text>
        </View>
        <View style={styles.statBox}>
          <Activity size={28} color={imcColor} />
          <Text style={styles.statNumber}>{imc}</Text>
          <Text style={styles.statDesc}>IMC ({imcStatus})</Text>
        </View>
      </View>

      <View style={styles.historyHeader}>
        <Text style={styles.sectionTitle}>Evolución de Peso</Text>
      </View>
      
      <View style={styles.chartCard}>
        {chartData.length < 2 ? (
          <View style={styles.emptyChart}>
            <TrendingDown size={32} color="#B3D4FF" style={{marginBottom: 10}}/>
            <Text style={styles.emptyText}>Registra tu peso al menos dos días diferentes para ver tu curva de progreso.</Text>
          </View>
        ) : (
          <>
            <Text style={styles.chartHintText}>Toca un punto para gestionar el registro</Text>
            <View style={styles.customChartContainer}>
              {/* ✅ Aplicado "as any" a las posiciones relativas para evitar el quejido de TypeScript */}
              <View style={[styles.targetLineChart, { bottom: `${((userData.targetWeight - minChartWeight) / chartRange) * 100}%` as any }]} />
              <Text style={[styles.targetLineLabel, { bottom: `${((userData.targetWeight - minChartWeight) / chartRange) * 100}%` as any }]}>Meta</Text>

              {chartData.map((log, index) => {
                const xPos = `${(index / (chartData.length - 1)) * 90 + 5}%`; 
                const yPos = `${((log.weight - minChartWeight) / chartRange) * 100}%`;
                
                return (
                  <TouchableOpacity 
                    key={log.id} 
                    style={[styles.chartPointWrapper, { left: xPos as any, bottom: yPos as any }]}
                    onPress={() => deleteWeightPrompt(log.id, log.weight)}
                    hitSlop={{top: 15, bottom: 15, left: 15, right: 15}}
                  >
                    <View style={styles.chartDot} />
                    <Text style={styles.chartDotText}>{log.weight}</Text>
                    <Text style={styles.chartDateText}>{formatDateShort(log.date)}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </>
        )}
      </View>

      <Modal visible={profileModalVisible} animationType="slide" transparent={true}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Configurar Perfil</Text>
              <TouchableOpacity onPress={() => setProfileModalVisible(false)}><X size={24} color="#003366" /></TouchableOpacity>
            </View>
            
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.inputLabel}>Género biológico (Fórmula Metabólica)</Text>
              <View style={styles.radioRow}>
                <TouchableOpacity style={[styles.radioBtn, form.gender === 'male' && styles.radioBtnActive]} onPress={() => setForm({...form, gender: 'male'})}>
                  <Text style={[styles.radioText, form.gender === 'male' && styles.radioTextActive]}>Hombre</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.radioBtn, form.gender === 'female' && styles.radioBtnActive]} onPress={() => setForm({...form, gender: 'female'})}>
                  <Text style={[styles.radioText, form.gender === 'female' && styles.radioTextActive]}>Mujer</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.inputRow}>
                <View style={styles.inputHalf}>
                  <Text style={styles.inputLabel}>Edad</Text>
                  <TextInput style={styles.inputField} keyboardType="numeric" value={(form.age || '').toString()} onChangeText={(t) => setForm({...form, age: Number(t)})} />
                </View>
                <View style={styles.inputHalf}>
                  <Text style={styles.inputLabel}>Altura (cm)</Text>
                  <TextInput style={styles.inputField} keyboardType="numeric" value={(form.height || '').toString()} onChangeText={(t) => setForm({...form, height: Number(t)})} />
                </View>
              </View>

              <Text style={styles.sectionDivider}>Tu Objetivo</Text>

              <View style={styles.inputRow}>
                <View style={styles.inputHalf}>
                  <Text style={styles.inputLabel}>Peso Actual (kg)</Text>
                  <TextInput style={styles.inputField} keyboardType="numeric" value={(form.currentWeight || '').toString()} onChangeText={(t) => setForm({...form, currentWeight: Number(t)})} />
                </View>
                <View style={styles.inputHalf}>
                  <Text style={styles.inputLabel}>Peso Meta (kg)</Text>
                  <TextInput style={styles.inputField} keyboardType="numeric" value={(form.targetWeight || '').toString()} onChangeText={(t) => setForm({...form, targetWeight: Number(t)})} />
                </View>
              </View>

              <Text style={styles.inputLabel}>¿En cuántas semanas quieres lograrlo?</Text>
              <TextInput style={styles.inputField} keyboardType="numeric" value={(form.weeksToGoal || '').toString()} onChangeText={(t) => setForm({...form, weeksToGoal: Number(t)})} />
              <Text style={styles.helpText}>Se recomienda perder entre 0.5kg y 1kg por semana para que sea saludable.</Text>

              <Text style={styles.sectionDivider}>Nivel de Actividad</Text>
              <View style={styles.activityGrid}>
                <TouchableOpacity style={[styles.actBtn, form.activityLevel === 'sed' && styles.actBtnActive]} onPress={() => setForm({...form, activityLevel: 'sed'})}>
                  <Text style={[styles.actText, form.activityLevel === 'sed' && styles.actTextActive]}>Sedentario</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.actBtn, form.activityLevel === 'light' && styles.actBtnActive]} onPress={() => setForm({...form, activityLevel: 'light'})}>
                  <Text style={[styles.actText, form.activityLevel === 'light' && styles.actTextActive]}>Ligero (1-3 días)</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.actBtn, form.activityLevel === 'mod' && styles.actBtnActive]} onPress={() => setForm({...form, activityLevel: 'mod'})}>
                  <Text style={[styles.actText, form.activityLevel === 'mod' && styles.actTextActive]}>Moderado (3-5)</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.actBtn, form.activityLevel === 'active' && styles.actBtnActive]} onPress={() => setForm({...form, activityLevel: 'active'})}>
                  <Text style={[styles.actText, form.activityLevel === 'active' && styles.actTextActive]}>Muy Activo (+6)</Text>
                </TouchableOpacity>
              </View>

              <TouchableOpacity style={styles.saveMainBtn} onPress={saveProfile}>
                <Text style={styles.saveMainBtnText}>Calcular y Guardar Perfil</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal visible={weightModalVisible} transparent={true} animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.smallModalContent}>
            <Text style={styles.modalTitle}>¿Cuánto pesas hoy?</Text>
            <Text style={styles.inputLabel}>Peso en kg</Text>
            <TextInput style={styles.inputField} keyboardType="numeric" placeholder={(userData.currentWeight || '').toString()} value={newWeight} onChangeText={setNewWeight} autoFocus={true} />
            <View style={styles.btnRow}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setWeightModalVisible(false)}>
                <Text style={styles.cancelBtnText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.saveBtn} onPress={logNewWeight}>
                <Text style={styles.saveBtnText}>Guardar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

    </ScrollView>
  );
}

const styles = StyleSheet.create({
  mainContainer: { flex: 1, backgroundColor: '#F0F8FF', padding: 20 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F0F8FF' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 40, marginBottom: 25 },
  profileInfo: { flexDirection: 'row', alignItems: 'center' },
  avatar: { width: 64, height: 64, borderRadius: 32, backgroundColor: '#E6F0FA', justifyContent: 'center', alignItems: 'center', marginRight: 15, borderWidth: 2, borderColor: '#4C8BF5' },
  nameText: { fontSize: 24, fontWeight: '900', color: '#003366' },
  subtitleText: { fontSize: 14, color: '#6699CC', fontWeight: 'bold', marginTop: 2 },
  editBtn: { backgroundColor: '#FFFFFF', padding: 12, borderRadius: 20, borderWidth: 1, borderColor: '#B3D4FF' },
  
  card: { backgroundColor: '#FFFFFF', borderRadius: 24, padding: 20, marginBottom: 25, borderWidth: 1, borderColor: '#B3D4FF', elevation: 2 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
  cardTitle: { fontSize: 18, fontWeight: 'bold', color: '#003366', marginLeft: 10 },
  weightRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, paddingHorizontal: 10 },
  weightBox: { alignItems: 'center' },
  weightLabel: { fontSize: 12, color: '#6699CC', fontWeight: 'bold', marginBottom: 5 },
  weightValue: { fontSize: 32, fontWeight: '900', color: '#0047AB' },
  weightUnit: { fontSize: 16, color: '#6699CC', fontWeight: '600' },
  progressBarBg: { height: 12, backgroundColor: '#E6F0FA', borderRadius: 6, overflow: 'hidden', marginBottom: 10 },
  progressBarFill: { height: '100%', backgroundColor: '#4C8BF5', borderRadius: 6 },
  progressText: { textAlign: 'center', fontSize: 13, color: '#6699CC', fontWeight: 'bold', marginBottom: 20 },
  logWeightBtn: { backgroundColor: '#0047AB', flexDirection: 'row', justifyContent: 'center', alignItems: 'center', padding: 16, borderRadius: 16 },
  logWeightBtnText: { color: '#FFFFFF', fontWeight: 'bold', fontSize: 16, marginLeft: 10 },

  sectionTitle: { fontSize: 20, fontWeight: '900', color: '#003366', marginBottom: 15 },
  statsGrid: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 30 },
  statBox: { backgroundColor: '#FFFFFF', width: '31%', padding: 15, borderRadius: 20, alignItems: 'center', borderWidth: 1, borderColor: '#E6F0FA' },
  statNumber: { fontSize: 18, fontWeight: '900', color: '#003366', marginTop: 10 },
  statDesc: { fontSize: 11, color: '#6699CC', textAlign: 'center', marginTop: 2, fontWeight: '600' },

  historyHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  
  chartCard: { backgroundColor: '#FFFFFF', padding: 20, borderRadius: 24, borderWidth: 1, borderColor: '#B3D4FF', marginBottom: 30 },
  emptyChart: { height: 180, justifyContent: 'center', alignItems: 'center', padding: 20 },
  emptyText: { color: '#6699CC', textAlign: 'center', fontStyle: 'italic', fontWeight: '500' },
  chartHintText: { fontSize: 11, color: '#6699CC', textAlign: 'center', fontStyle: 'italic', marginBottom: 5 },
  customChartContainer: { height: 200, width: '100%', position: 'relative', marginTop: 20, marginBottom: 30 },
  targetLineChart: { position: 'absolute', left: 0, right: 0, height: 2, backgroundColor: '#FF6B6B', borderStyle: 'dashed', opacity: 0.4 },
  targetLineLabel: { position: 'absolute', left: 0, fontSize: 10, color: '#FF6B6B', fontWeight: 'bold', marginTop: -15 },
  chartPointWrapper: { position: 'absolute', alignItems: 'center', width: 40, marginLeft: -20, marginBottom: -6 },
  chartDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: '#0047AB', borderWidth: 2, borderColor: '#FFFFFF', elevation: 3 },
  chartDotText: { fontSize: 12, fontWeight: '900', color: '#003366', position: 'absolute', top: -20 },
  chartDateText: { fontSize: 10, color: '#6699CC', fontWeight: 'bold', position: 'absolute', bottom: -22, width: 50, textAlign: 'center' },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0, 51, 102, 0.6)', justifyContent: 'center', padding: 20 },
  modalContent: { backgroundColor: '#F0F8FF', borderRadius: 24, padding: 25, maxHeight: '90%' },
  smallModalContent: { backgroundColor: '#FFFFFF', borderRadius: 24, padding: 25 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle: { fontSize: 22, fontWeight: '900', color: '#003366' },
  inputLabel: { fontSize: 13, color: '#003366', fontWeight: 'bold', marginBottom: 8 },
  inputField: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#B3D4FF', borderRadius: 12, padding: 15, fontSize: 16, color: '#003366', marginBottom: 15 },
  inputRow: { flexDirection: 'row', justifyContent: 'space-between' },
  inputHalf: { width: '48%' },
  sectionDivider: { fontSize: 18, fontWeight: '900', color: '#0047AB', marginTop: 10, marginBottom: 15, borderBottomWidth: 1, borderBottomColor: '#B3D4FF', paddingBottom: 5 },
  helpText: { fontSize: 11, color: '#6699CC', fontStyle: 'italic', marginBottom: 15, marginTop: -10 },
  radioRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 },
  radioBtn: { flex: 1, padding: 15, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#B3D4FF', borderRadius: 12, alignItems: 'center', marginHorizontal: 5 },
  radioBtnActive: { backgroundColor: '#0047AB', borderColor: '#0047AB' },
  radioText: { color: '#003366', fontWeight: 'bold' },
  radioTextActive: { color: '#FFFFFF' },
  activityGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', marginBottom: 20 },
  actBtn: { width: '48%', padding: 15, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#B3D4FF', borderRadius: 12, alignItems: 'center', marginBottom: 10 },
  actBtnActive: { backgroundColor: '#0047AB', borderColor: '#0047AB' },
  actText: { color: '#003366', fontWeight: 'bold', fontSize: 12, textAlign: 'center' },
  actTextActive: { color: '#FFFFFF' },
  saveMainBtn: { backgroundColor: '#4C8BF5', padding: 18, borderRadius: 16, alignItems: 'center', marginTop: 10, marginBottom: 20 },
  saveMainBtnText: { color: '#FFFFFF', fontWeight: '900', fontSize: 16 },
  btnRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 10 },
  cancelBtn: { padding: 15, flex: 1, backgroundColor: '#E6F0FA', borderRadius: 12, alignItems: 'center', marginRight: 10 },
  cancelBtnText: { color: '#0047AB', fontWeight: 'bold' },
  saveBtn: { padding: 15, flex: 1, backgroundColor: '#0047AB', borderRadius: 12, alignItems: 'center', marginLeft: 10 },
  saveBtnText: { color: '#FFFFFF', fontWeight: 'bold' }
});