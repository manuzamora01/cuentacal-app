import { Tabs } from 'expo-router';
import { Home, LineChart, User } from 'lucide-react-native';

export default function TabLayout() {
  return (
    <Tabs 
      screenOptions={{ 
        tabBarActiveTintColor: '#0047AB', // Tu color azul activo
        tabBarInactiveTintColor: '#6699CC', // Azul grisáceo inactivo
        headerShown: false,
        tabBarStyle: {
          backgroundColor: '#FFFFFF',
          borderTopColor: '#E6F0FA',
          paddingBottom: 5,
          paddingTop: 5,
          height: 60
        }
      }}
    >
      <Tabs.Screen 
        name="index" 
        options={{ 
          title: 'Inicio', 
          tabBarIcon: ({ color }) => <Home size={24} color={color} /> 
        }} 
      />
      <Tabs.Screen 
        name="progreso" 
        options={{ 
          title: 'Progreso', 
          tabBarIcon: ({ color }) => <LineChart size={24} color={color} /> 
        }} 
      />
      <Tabs.Screen 
        name="perfil" 
        options={{ 
          title: 'Perfil', 
          tabBarIcon: ({ color }) => <User size={24} color={color} /> 
        }} 
      />
    </Tabs>
  );
}