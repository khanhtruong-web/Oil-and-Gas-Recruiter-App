import { useState, useEffect } from 'react';
import { doc, onSnapshot, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { handleFirestoreError, OperationType } from '../lib/firestore-error';

export interface DisciplineDef {
    id: string;
    name: string;
    keywords: string[];
    description?: string;
}

const DEFAULT_DISCIPLINE_OBJECTS: DisciplineDef[] = [
    {id:'drilling',name:'Drilling',keywords:['drilling','wellbore','bha','mud','rig','driller','well control'], description: 'Drilling operations and wellbore management'},
    {id:'petroleum',name:'Petroleum Engineering',keywords:['reservoir','production','pvt','eor','petroleum','well test'], description: 'Reservoir engineering, production optimization'},
    {id:'hse',name:'HSE',keywords:['safety','hazop','risk assessment','permit','incident','hse','ehs','environment'], description: 'Health, Safety, and Environment management'},
    {id:'pipeline',name:'Pipeline',keywords:['pipeline','pigging','cathodic','coating','pig launcher','welding pipeline'], description: 'Pipeline design, construction, and maintenance'},
    {id:'mechanical',name:'Mechanical Engineering',keywords:['mechanical','rotating','pump','compressor','turbine','vessel','heat exchanger'], description: 'Rotating equipment, static vessels, HVAC'},
    {id:'electrical',name:'Electrical / Instrumentation',keywords:['electrical','instrumentation','plc','dcs','scada','e&i','control system'], description: 'Power generation, distribution, control systems'},
    {id:'process',name:'Process Engineering',keywords:['process','simulation','feed','p&id','process safety','flare','process engineer'], description: 'Process simulation, P&ID development'},
    {id:'subsea',name:'Subsea',keywords:['subsea','rov','umbilical','riser','subsea tree','flowline'], description: 'Subsea systems, ROV operations'},
    {id:'ndt',name:'NDT / Inspection',keywords:['ndt','inspection','ultrasonic','radiography','magnetic particle','penetrant','corrosion'], description: 'Non-destructive testing and quality inspection'},
    {id:'project',name:'Project Management',keywords:['project management','pmo','schedule','cost control','procurement','planning','project manager'], description: 'Project planning, scheduling, cost control'},
    {id:'geoscience',name:'Geoscience',keywords:['geology','geophysics','seismic','well log','petrophysics','geologist'], description: 'Geology, geophysics, seismic interpretation'},
    {id:'marine',name:'Marine / Naval',keywords:['marine','vessel','offshore','dp','anchor handling','naval','captain','marine engineer'], description: 'Marine operations, vessel management, naval architecture'}
];

export const useDisciplines = () => {
    const [disciplines, setDisciplines] = useState<DisciplineDef[]>(DEFAULT_DISCIPLINE_OBJECTS);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const docRef = doc(db, 'system', 'disciplines');
        const unsubscribe = onSnapshot(docRef, (snap) => {
            if (snap.exists() && snap.data().listDetailed) {
                setDisciplines(snap.data().listDetailed);
            } else if (snap.exists() && snap.data().list) {
                // Migration from simple string format
                setDisciplines(snap.data().list.map((name: string) => ({
                    id: name.toLowerCase().replace(/[^a-z0-9]/g, '_'),
                    name,
                    keywords: [name.toLowerCase()]
                })));
            } else {
                setDisciplines(DEFAULT_DISCIPLINE_OBJECTS);
            }
            setLoading(false);
        }, (error) => {
            handleFirestoreError(error, OperationType.GET, 'system/disciplines');
            setLoading(false);
        });

        return () => unsubscribe();
    }, []);

    const updateDisciplines = async (newList: DisciplineDef[]) => {
        try {
            const docRef = doc(db, 'system', 'disciplines');
            await setDoc(docRef, { 
                listDetailed: newList, 
                // maintain string list for any generic consumers
                list: newList.map(d => d.name),
                updatedAt: serverTimestamp() 
            });
        } catch (error) {
            handleFirestoreError(error, OperationType.WRITE, 'system/disciplines');
        }
    };

    return { 
        disciplines: disciplines.map(d => d.name), 
        disciplineDetails: disciplines,
        loading, 
        updateDisciplines 
    };
};
