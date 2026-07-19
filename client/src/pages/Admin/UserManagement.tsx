import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Users, Shield, GraduationCap } from 'lucide-react';

export const UserManagement: React.FC = () => {
  const [students, setStudents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStudents();
  }, []);

  const fetchStudents = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get('/api/admin/all-students', {
        headers: { Authorization: `Bearer ${token}` },
      });
      setStudents(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="p-6">Loading students...</div>;
  }

  // Group by department
  const grouped = students.reduce((acc: any, student: any) => {
    const dept = student.department || 'Unknown Department';
    if (!acc[dept]) acc[dept] = [];
    acc[dept].push(student);
    return acc;
  }, {});

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">All Students</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Grouped by department (Hardware / Software).
        </p>
      </div>

      <div className="space-y-8">
        {Object.keys(grouped).map((dept) => (
          <div
            key={dept}
            className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden"
          >
            <div className="px-6 py-4 border-b border-gray-200 bg-gray-50 flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                <GraduationCap className="w-5 h-5 text-indigo-600" />
                {dept}
              </h2>
              <span className="px-3 py-1 bg-indigo-100 text-indigo-800 text-xs font-bold rounded-full">
                {grouped[dept].length} Students
              </span>
            </div>

            <div className="divide-y divide-gray-100">
              {grouped[dept].map((student: any) => (
                <div
                  key={student.id}
                  className="px-6 py-4 flex items-center justify-between hover:bg-gray-50"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold">
                      {student.fullName.substring(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <h4 className="font-semibold text-gray-900">{student.fullName}</h4>
                      <p className="text-xs text-gray-500">{student.email}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-xs font-medium text-gray-500 block mb-1">
                      {student.team ? `Team: ${student.team.name}` : 'No Team'}
                    </span>
                    <span className="text-xs font-bold text-gray-700 block">
                      {student.rewardPoints || 0} AP
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
