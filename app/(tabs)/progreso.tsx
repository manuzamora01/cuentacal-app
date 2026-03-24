import React, { useState, useEffect, useMemo } from 'react';
import { StyleSheet, Text, View, ScrollView, ActivityIndicator, TouchableOpacity } from 'react-native';
import { BarChart2, TrendingUp, Flame, ChevronLeft, ChevronRight, Droplets } from 'lucide-react-native';
import { collection, onSnapshot, query, orderBy, doc } from 'firebase/firestore';
import { db } from '../../firebase';

const formatCustomDate = (date: Date) => {
  const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
  return `${date.getDate()} ${months[date.getMonth()]}`;
};

export default function ProgressScreen() {
  const [loading, setLoading] = useState(true);
  const [foodList, setFoodList] = useState<any[]>([]);
  const [waterList, setWaterList] = useState<any[]>([]);
  
  const [metaCalorias, setMetaCalorias] = useState(2000);
  const [metaAgua, setMetaAgua] = useState(2500);
  
  const [weekOffset, setWeekOffset] = useState(0);

  useEffect(() => {
    // Escucha en tiempo real del perfil para tener los datos actualizados
    const unsubProfile = onSnapshot(doc(db, "usuarios", "mi_perfil"), (docSnap) => {
      if (docSnap.exists()) {
        setMetaCalorias(docSnap.data().metaCalorias || 2000);
        setMetaAgua(docSnap.data().metaAgua || 2500);
      }
    });

    const unsubComidas = onSnapshot(query(collection(db, "comidas"), orderBy("timestamp", "desc")), (snapshot) => {
      setFoodList(snapshot.docs.map(doc => ({ 
        ...doc.data(), 
        jsDate: doc.data().timestamp?.toDate ? doc.data().timestamp.toDate() : new Date() 
      })));
      setLoading(false);
    });

    const unsubAgua = onSnapshot(query(collection(db, "agua"), orderBy("timestamp", "desc")), (snapshot) => {
      setWaterList(snapshot.docs.map(doc => ({ 
        ...doc.data(), 
        jsDate: doc.data().timestamp?.toDate ? doc.data().timestamp.toDate() : new Date() 
      })));
    });

    return () => { unsubProfile(); unsubComidas(); unsubAgua(); };
  }, []);

  const chartData = useMemo(() => {
    const today = new Date();
    today.setDate(today.getDate() + (weekOffset * 7));

    const currentDayOfWeek = today.getDay(); 
    const distToMonday = currentDayOfWeek === 0 ? -6 : 1 - currentDayOfWeek;
    const monday = new Date(today);
    monday.setDate(today.getDate() + distToMonday);

    const days = [];
    let avgCals = 0;
    let avgWater = 0;
    let totalProtein = 0, totalCarbs = 0, totalFat = 0;
    
    for (let i = 0; i < 7; i++) {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      const dateString = d.toDateString();
      
      const dayFoods = foodList.filter(f => f.jsDate && f.jsDate.toDateString() === dateString);
      const dayWaterLogs = waterList.filter(w => w.jsDate && w.jsDate.toDateString() === dateString);

      const cals = dayFoods.reduce((sum, item) => sum + item.calories, 0);
      const protein = dayFoods.reduce((sum, item) => sum + item.protein, 0);
      const carbs = dayFoods.reduce((sum, item) => sum + item.carbs, 0);
      const fat = dayFoods.reduce((sum, item) => sum + item.fat, 0);
      const water = dayWaterLogs.reduce((sum, item) => sum + item.amount, 0);
      
      days.push({
        dayName: ['L', 'M', 'X', 'J', 'V', 'S', 'D'][i],
        calories: cals,
        isToday: dateString === new Date().toDateString()
      });

      avgCals += cals;
      avgWater += water;
      totalProtein += protein;
      totalCarbs += carbs;
      totalFat += fat;
    }

    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    
    let headerText = '';
    if (monday.getMonth() === sunday.getMonth()) {
      headerText = `${monday.getDate()} - ${formatCustomDate(sunday)}`;
    } else {
      headerText = `${formatCustomDate(monday)} - ${formatCustomDate(sunday)}`;
    }

    return { 
      days, 
      headerText,
      averageCals: Math.round(avgCals / 7), 
      averageWater: Math.round(avgWater / 7),
      avgProtein: Math.round(totalProtein / 7),
      avgCarbs: Math.round(totalCarbs / 7),
      avgFat: Math.round(totalFat / 7)
    };
  }, [foodList, waterList, weekOffset]);

  const maxCalories = Math.max(...chartData.days.map(d => d.calories), metaCalorias, 1);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#0047AB" />
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
      <View style={styles.header}>
        <Text style={styles.title}>Tu Progreso</Text>
        
        <View style={styles.weekNavRow}>
          <TouchableOpacity onPress={() => setWeekOffset(prev => prev - 1)} style={styles.navBtn}>
             <ChevronLeft size={20} color="#0047AB" />
          </TouchableOpacity>
          <Text style={styles.subtitle}>{chartData.headerText}</Text>
          <TouchableOpacity onPress={() => setWeekOffset(prev => prev + 1)} style={styles.navBtn}>
             <ChevronRight size={20} color="#0047AB" />
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.summaryRow}>
        <View style={styles.summaryCard}>
          <TrendingUp size={24} color="#0047AB" />
          <Text style={styles.summaryValue}>{chartData.averageCals}</Text>
          <Text style={styles.summaryLabel}>Media kcal/día</Text>
        </View>
        <View style={styles.summaryCard}>
          <Flame size={24} color="#4C8BF5" />
          <Text style={styles.summaryValue}>{metaCalorias}</Text>
          <Text style={styles.summaryLabel}>Tu Meta</Text>
        </View>
      </View>

      <View style={styles.chartCard}>
        <View style={styles.chartHeader}>
          <BarChart2 size={20} color="#003366" />
          <Text style={styles.chartTitle}>Calorías Consumidas</Text>
        </View>

        <View style={styles.chartArea}>
          <View style={[styles.targetLine, { bottom: `${(metaCalorias / maxCalories) * 100}%` }]} />
          
          {chartData.days.map((day, index) => {
            const barHeight = `${(day.calories / maxCalories) * 100}%`;
            const isOver = day.calories > metaCalorias;
            
            return (
              <View key={index} style={styles.barContainer}>
                <View style={styles.barBackground}>
                  <View 
                    style={[
                      styles.barFill, 
                      { height: barHeight as any },
                      isOver ? { backgroundColor: '#FF6B6B' } : {}, 
                      day.isToday ? { opacity: 1 } : { opacity: 0.7 } 
                    ]} 
                  />
                </View>
                <Text style={[styles.dayText, day.isToday && styles.dayTextToday]}>{day.dayName}</Text>
              </View>
            );
          })}
        </View>
        <View style={styles.legendRow}>
          <View style={styles.legendItem}><View style={[styles.legendDot, {backgroundColor: '#0047AB'}]}/><Text style={styles.legendText}>En meta</Text></View>
          <View style={styles.legendItem}><View style={[styles.legendDot, {backgroundColor: '#FF6B6B'}]}/><Text style={styles.legendText}>Exceso</Text></View>
          <View style={styles.legendItem}><View style={styles.legendLine}/><Text style={styles.legendText}>Meta diaria</Text></View>
        </View>
      </View>

      <Text style={[styles.title, {fontSize: 22, marginTop: 10, marginBottom: 15}]}>Promedios de la Semana</Text>
      
      <View style={styles.statsGrid}>
        <View style={styles.statBox}>
          <Droplets size={26} color="#4C8BF5" />
          <Text style={styles.statNumber}>{chartData.averageWater} <Text style={{fontSize: 12}}>ml</Text></Text>
          <Text style={styles.statDesc}>Agua / día</Text>
        </View>
        <View style={styles.statBox}>
          <Text style={{fontSize: 22}}>🥩</Text>
          <Text style={styles.statNumber}>{chartData.avgProtein}g</Text>
          <Text style={styles.statDesc}>Proteína</Text>
        </View>
      </View>
      
      <View style={styles.statsGrid}>
        <View style={styles.statBox}>
          <Text style={{fontSize: 22}}>🍞</Text>
          <Text style={styles.statNumber}>{chartData.avgCarbs}g</Text>
          <Text style={styles.statDesc}>Hidratos</Text>
        </View>
        <View style={styles.statBox}>
          <Text style={{fontSize: 22}}>🥑</Text>
          <Text style={styles.statNumber}>{chartData.avgFat}g</Text>
          <Text style={styles.statDesc}>Grasas</Text>
        </View>
      </View>

    </ScrollView>
  );
}

const styles = StyleSheet.create({
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F0F8FF' },
  container: { flexGrow: 1, backgroundColor: '#F0F8FF', padding: 20, paddingTop: 60, paddingBottom: 100 },
  header: { marginBottom: 25 },
  title: { fontSize: 28, fontWeight: '900', color: '#003366', marginBottom: 15 },
  
  weekNavRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 10 },
  subtitle: { fontSize: 16, fontWeight: 'bold', color: '#003366' },
  navBtn: { padding: 5, backgroundColor: '#FFFFFF', borderRadius: 10, borderWidth: 1, borderColor: '#E6F0FA' },

  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 },
  summaryCard: { backgroundColor: '#FFFFFF', borderRadius: 20, padding: 20, width: '48%', alignItems: 'center', borderWidth: 1, borderColor: '#B3D4FF' },
  summaryValue: { fontSize: 24, fontWeight: '900', color: '#003366', marginTop: 10 },
  summaryLabel: { fontSize: 12, color: '#6699CC', marginTop: 5, fontWeight: 'bold' },

  chartCard: { backgroundColor: '#FFFFFF', borderRadius: 24, padding: 20, borderWidth: 1, borderColor: '#B3D4FF', marginBottom: 20 },
  chartHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 30 },
  chartTitle: { fontSize: 18, fontWeight: 'bold', color: '#003366', marginLeft: 10 },
  
  chartArea: { height: 200, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', paddingBottom: 25, borderBottomWidth: 1, borderBottomColor: '#E6F0FA', position: 'relative' },
  targetLine: { position: 'absolute', left: 0, right: 0, height: 1, backgroundColor: '#4C8BF5', borderStyle: 'dashed', opacity: 0.5, zIndex: 0 },
  
  barContainer: { alignItems: 'center', width: '10%', zIndex: 1 },
  barBackground: { width: 12, height: 150, backgroundColor: '#F0F8FF', borderRadius: 6, justifyContent: 'flex-end', overflow: 'hidden' },
  barFill: { width: '100%', backgroundColor: '#0047AB', borderRadius: 6 },
  dayText: { fontSize: 12, color: '#6699CC', fontWeight: 'bold', marginTop: 10, position: 'absolute', bottom: -20 },
  dayTextToday: { color: '#0047AB', fontWeight: '900' },

  legendRow: { flexDirection: 'row', justifyContent: 'center', marginTop: 20 },
  legendItem: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 10 },
  legendDot: { width: 10, height: 10, borderRadius: 5, marginRight: 5 },
  legendLine: { width: 15, height: 2, backgroundColor: '#4C8BF5', marginRight: 5 },
  legendText: { fontSize: 11, color: '#6699CC', fontWeight: 'bold' },

  statsGrid: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 15 },
  statBox: { backgroundColor: '#FFFFFF', width: '48%', padding: 15, borderRadius: 20, alignItems: 'center', borderWidth: 1, borderColor: '#E6F0FA' },
  statNumber: { fontSize: 20, fontWeight: '900', color: '#003366', marginTop: 8 },
  statDesc: { fontSize: 12, color: '#6699CC', textAlign: 'center', marginTop: 2, fontWeight: '600' }
});